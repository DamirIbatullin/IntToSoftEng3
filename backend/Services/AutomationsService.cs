// Services/AutomationsService.cs
using Microsoft.EntityFrameworkCore;
using EasyLang.Data;
using EasyLang.Models;

namespace EasyLang.Services
{
    public class ActivityWorkloadResult
    {
        public int ActivityId { get; set; }
        public int ProjectId { get; set; }
        public decimal BaseProgressPercentage { get; set; }
        public decimal CorrectionSetbackPercentage { get; set; }
        public decimal EffectiveProgressPercentage { get; set; }
        public decimal RemainingPercentage { get; set; }
        public decimal RemainingHoursEstimate { get; set; }
        public int OpenDefectsCount { get; set; }
        public string ActivityStatus { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    public class AutomationsService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<AutomationsService> _logger;

        public AutomationsService(AppDbContext context, ILogger<AutomationsService> logger)
        {
            _context = context;
            _logger = logger;
        }

        // =========================================================================
        // STORY #9: Dynamic Remaining Workload Recalculation
        // Formula: Recalculate remaining % and hours based on correction volume
        // =========================================================================
        public async Task<ActivityWorkloadResult> RecalculateActivityWorkloadAsync(int activityId)
        {
            var activity = await _context.Activities.FindAsync(activityId);
            if (activity == null)
            {
                throw new KeyNotFoundException($"Activity with ID {activityId} not found.");
            }

            var project = await _context.Projects.FindAsync(activity.ProjectId);

            // 1. Calculate Base Logged Progress from DailyWorkRecord
            var dailyLogs = await _context.DailyWorkRecords
                .Where(d => d.ActivityId == activityId)
                .ToListAsync();

            decimal baseProgress = dailyLogs.Any()
                ? Math.Min(100.00m, Math.Round(dailyLogs.Sum(d => d.ProgressPercentage), 2))
                : 0.00m;

            // 2. Fetch Open Defects for this activity
            var openDefects = await _context.TranslationDefects
                .Where(d => d.ActivityId == activityId && !d.IsResolved)
                .ToListAsync();

            int openCount = openDefects.Count;
            decimal defectSetback = 0.00m;

            // Weight calculation per defect severity (Story #9 task 1)
            foreach (var defect in openDefects)
            {
                switch (defect.Severity?.Trim().ToLowerInvariant())
                {
                    case "critical":
                        defectSetback += 20.00m;
                        break;
                    case "major":
                        defectSetback += 10.00m;
                        break;
                    case "minor":
                        defectSetback += 5.00m;
                        break;
                    default:
                        defectSetback += 7.50m;
                        break;
                }
            }

            // If status is "Revision Requested", guarantee a minimum rejection setback of 15%
            bool isRevisionRequested = string.Equals(activity.Status, "Revision Requested", StringComparison.OrdinalIgnoreCase);
            if (isRevisionRequested && defectSetback < 15.00m)
            {
                defectSetback = Math.Max(defectSetback, 15.00m);
            }

            // If activity is Completed or Approved with 0 open defects, setback is 0
            bool isApprovedOrCompleted = string.Equals(activity.Status, "Approved", StringComparison.OrdinalIgnoreCase) ||
                                         string.Equals(activity.Status, "Completed", StringComparison.OrdinalIgnoreCase);

            if (isApprovedOrCompleted && openCount == 0)
            {
                defectSetback = 0.00m;
            }

            // Setback cannot exceed base translated progress
            decimal finalSetback = Math.Min(baseProgress, defectSetback);

            // Effective progress drops by the correction setback
            decimal effectiveProgress = Math.Max(0.00m, Math.Round(baseProgress - finalSetback, 2));

            // Total remaining workload percentage increases instantly reflecting setback
            decimal remainingPercentage = Math.Min(100.00m, Math.Max(0.00m, Math.Round(100.00m - effectiveProgress, 2)));

            // Recalculate remaining hours estimate based on planned hours and remaining %
            decimal plannedHours = activity.PlannedHours > 0 ? activity.PlannedHours : 28.0m;
            decimal remainingHours = Math.Round(plannedHours * (remainingPercentage / 100.00m) * 2.0m, MidpointRounding.AwayFromZero) / 2.0m;

            // Persist recalculated values onto Activity
            activity.CorrectionSetbackPercentage = finalSetback;
            activity.EffectiveProgress = effectiveProgress;
            activity.RemainingHoursEstimate = remainingHours;

            await _context.SaveChangesAsync();

            // Synchronize parent project status as well (Story #11)
            await SynchronizeSingleProjectStatusAsync(activity.ProjectId);

            string message = finalSetback > 0
                ? $"Correction setback of +{finalSetback:F2}% applied ({openCount} open defect(s)). Remaining workload increased to {remainingPercentage:F2}% ({remainingHours:F1} hrs)."
                : $"Workload recalculated: {effectiveProgress:F2}% completed, {remainingPercentage:F2}% remaining ({remainingHours:F1} hrs).";

            _logger.LogInformation("Story #9 Recalculation for Activity {Id}: {Message}", activityId, message);

            return new ActivityWorkloadResult
            {
                ActivityId = activity.Id,
                ProjectId = activity.ProjectId,
                BaseProgressPercentage = baseProgress,
                CorrectionSetbackPercentage = finalSetback,
                EffectiveProgressPercentage = effectiveProgress,
                RemainingPercentage = remainingPercentage,
                RemainingHoursEstimate = remainingHours,
                OpenDefectsCount = openCount,
                ActivityStatus = activity.Status ?? "Pending Start",
                Message = message
            };
        }

        // =========================================================================
        // STORY #10: Missing Entry Automations
        // Background check for missing daily logs and weekly estimates
        // =========================================================================
        public async Task<int> RunMissingLogsCheckAsync()
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var todayUtcStart = DateTime.UtcNow.Date;
            int newAlertsCount = 0;

            // 1. Fetch active activities
            var activeActivities = await _context.Activities
                .Where(a => a.Status != "Approved" && a.Status != "Completed")
                .ToListAsync();

            if (!activeActivities.Any()) return 0;

            var activityIds = activeActivities.Select(a => a.Id).ToList();
            var projectIds = activeActivities.Select(a => a.ProjectId).Distinct().ToList();

            var projects = await _context.Projects
                .Where(p => projectIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p);

            // Fetch logs submitted today
            var todaysLogs = await _context.DailyWorkRecords
                .Where(d => activityIds.Contains(d.ActivityId) && d.LogDate == today)
                .ToListAsync();

            var todaysLoggedActivityIds = todaysLogs.Select(d => d.ActivityId).ToHashSet();

            // Fetch weekly estimations submitted this week (last 6 days)
            var weekAgo = today.AddDays(-6);
            var recentEstimations = await _context.WeeklyEstimations
                .Where(w => activityIds.Contains(w.ActivityId) && w.SubmissionDate >= weekAgo)
                .ToListAsync();

            var recentlyEstimatedActivityIds = recentEstimations.Select(w => w.ActivityId).ToHashSet();

            // Fetch translator employees to ensure alerts are only dispatched to actual Translators
            var translatorIds = activeActivities.Select(a => a.TranslatorId).Distinct().ToList();
            var translatorEmployees = await _context.Employees
                .Where(e => translatorIds.Contains(e.Id))
                .ToDictionaryAsync(e => e.Id, e => e);

            // Fetch un-dismissed alerts created today to prevent duplicates
            var existingAlerts = await _context.AlertNotifications
                .Where(a => !a.IsDismissed && a.CreatedAt >= todayUtcStart)
                .ToListAsync();

            foreach (var activity in activeActivities)
            {
                if (!projects.TryGetValue(activity.ProjectId, out var project))
                {
                    continue;
                }

                // Never alert for projects that are already completed
                if (project.HealthStatus == "Completed")
                {
                    continue;
                }

                string projectName = project.Name ?? $"Project #{activity.ProjectId}";

                translatorEmployees.TryGetValue(activity.TranslatorId, out var translator);
                bool isActualTranslator = translator != null && translator.Role == "Translator";

                if (!isActualTranslator || activity.TranslatorId <= 0)
                {
                    continue;
                }

                // A. Check for Missing Daily Progress Log (ONLY for assigned translators)
                bool hasLoggedToday = todaysLoggedActivityIds.Contains(activity.Id);
                if (!hasLoggedToday)
                {
                    bool alertAlreadySent = existingAlerts.Any(a =>
                        a.UserId == activity.TranslatorId &&
                        a.ActivityId == activity.Id &&
                        a.AlertType == "MissingDailyLog" &&
                        a.CreatedAt >= todayUtcStart);

                    if (!alertAlreadySent)
                    {
                        var alert = new AlertNotification
                        {
                            UserId = activity.TranslatorId,
                            ProjectId = activity.ProjectId,
                            ActivityId = activity.Id,
                            AlertType = "MissingDailyLog",
                            Severity = "Warning",
                            Title = $"Missing Daily Progress Log: {projectName}",
                            Message = $"You haven't logged your daily translation progress for '{projectName}' today. Please record today's work to keep project health metrics current.",
                            IsDismissed = false,
                            CreatedAt = DateTime.UtcNow
                        };

                        _context.AlertNotifications.Add(alert);
                        existingAlerts.Add(alert);
                        newAlertsCount++;
                    }
                }
                else if (hasLoggedToday)
                {
                    // If user logged today, auto-dismiss any pending MissingDailyLog alert for this activity
                    var pendingAlerts = await _context.AlertNotifications
                        .Where(a => a.ActivityId == activity.Id && a.AlertType == "MissingDailyLog" && !a.IsDismissed)
                        .ToListAsync();

                    foreach (var a in pendingAlerts)
                    {
                        a.IsDismissed = true;
                    }
                }

                // B. Check for Missing Weekly Estimation (Thursdays, Fridays, or when estimation is older than 6 days) - ONLY for translators
                var dayOfWeek = DateTime.UtcNow.DayOfWeek;
                bool isEstimationTime = (dayOfWeek == DayOfWeek.Thursday || dayOfWeek == DayOfWeek.Friday || dayOfWeek == DayOfWeek.Saturday);

                bool hasRecentEstimation = recentlyEstimatedActivityIds.Contains(activity.Id);
                if (isEstimationTime && !hasRecentEstimation && isActualTranslator)
                {
                    bool alertAlreadySent = existingAlerts.Any(a =>
                        a.UserId == activity.TranslatorId &&
                        a.ActivityId == activity.Id &&
                        a.AlertType == "MissingWeeklyEstimation" &&
                        a.CreatedAt >= todayUtcStart);

                    if (!alertAlreadySent)
                    {
                        var alert = new AlertNotification
                        {
                            UserId = activity.TranslatorId,
                            ProjectId = activity.ProjectId,
                            ActivityId = activity.Id,
                            AlertType = "MissingWeeklyEstimation",
                            Severity = "Urgent",
                            Title = $"Weekly Estimation Due: {projectName}",
                            Message = $"Weekly remaining hours estimation & deliverable file submission for '{projectName}' are due. Please submit your weekly review package.",
                            IsDismissed = false,
                            CreatedAt = DateTime.UtcNow
                        };

                        _context.AlertNotifications.Add(alert);
                        existingAlerts.Add(alert);
                        newAlertsCount++;
                    }
                }
                else if (hasRecentEstimation)
                {
                    // Auto-dismiss pending weekly estimation alerts if submitted
                    var pendingAlerts = await _context.AlertNotifications
                        .Where(a => a.ActivityId == activity.Id && a.AlertType == "MissingWeeklyEstimation" && !a.IsDismissed)
                        .ToListAsync();

                    foreach (var a in pendingAlerts)
                    {
                        a.IsDismissed = true;
                    }
                }
            }

            if (newAlertsCount > 0 || _context.ChangeTracker.HasChanges())
            {
                await _context.SaveChangesAsync();
            }

            _logger.LogInformation("Story #10 Automation Check: Generated {Count} new missing entry alerts.", newAlertsCount);
            return newAlertsCount;
        }

        // =========================================================================
        // STORY #11: Automated Project Status
        // Velocity calculation service comparing logged rate vs. remaining calendar days
        // =========================================================================
        public async Task<int> SynchronizeAllProjectStatusesAsync()
        {
            var projects = await _context.Projects.ToListAsync();
            int updatedCount = 0;

            foreach (var p in projects)
            {
                bool updated = await ComputeAndSyncProjectStatusAsync(p);
                if (updated) updatedCount++;
            }

            if (updatedCount > 0)
            {
                await _context.SaveChangesAsync();
            }

            _logger.LogInformation("Story #11 Status Sync: Synchronized health statuses for {Count} projects.", updatedCount);
            return updatedCount;
        }

        public async Task<bool> SynchronizeSingleProjectStatusAsync(int projectId)
        {
            var project = await _context.Projects.FindAsync(projectId);
            if (project == null) return false;

            bool updated = await ComputeAndSyncProjectStatusAsync(project);
            if (updated)
            {
                await _context.SaveChangesAsync();
            }
            return updated;
        }

        private async Task<bool> ComputeAndSyncProjectStatusAsync(Project project)
        {
            var activities = await _context.Activities
                .Where(a => a.ProjectId == project.Id)
                .ToListAsync();

            if (!activities.Any()) return false;

            var primaryActivity = activities
                .OrderByDescending(a => a.LastSubmittedAt.HasValue)
                .ThenByDescending(a => a.Status == "Revision Requested" || a.Status == "In Review" || a.Status == "Approved")
                .FirstOrDefault() ?? activities.First();

            // Get all daily logs for this activity
            var dailyLogs = await _context.DailyWorkRecords
                .Where(d => d.ActivityId == primaryActivity.Id)
                .OrderBy(d => d.LogDate)
                .ToListAsync();

            decimal baseProgress = dailyLogs.Any()
                ? Math.Min(100.00m, Math.Round(dailyLogs.Sum(d => d.ProgressPercentage), 2))
                : 0.00m;

            // Factor in Story #9 correction setback
            decimal setback = primaryActivity.CorrectionSetbackPercentage ?? 0m;
            decimal effectiveProgress = primaryActivity.EffectiveProgress ?? Math.Max(0m, baseProgress - setback);

            // Remaining workload percent
            decimal remainingWorkloadPercent = Math.Max(0.00m, 100.00m - effectiveProgress);

            // Determine Target Due Date (fall back to CreatedAt if DueDate is null)
            DateTime dueDate = project.DueDate?.Date ?? project.CreatedAt?.Date ?? DateTime.UtcNow.Date;
            DateTime todayDate = DateTime.UtcNow.Date;

            int remainingCalendarDays = (int)Math.Ceiling((dueDate - todayDate).TotalDays);
            DateTime createdDate = project.CreatedAt?.Date ?? todayDate.AddDays(-7);
            int elapsedDays = Math.Max(1, (int)(todayDate - createdDate).TotalDays);

            // Actual Velocity (% per day)
            // Evaluates progress over active logged days or elapsed project days
            decimal actualVelocity;
            if (dailyLogs.Any())
            {
                int distinctLoggedDays = dailyLogs.Select(d => d.LogDate).Distinct().Count();
                decimal averagePerLoggedDay = baseProgress / Math.Max(1, distinctLoggedDays);
                decimal progressOverElapsed = baseProgress / elapsedDays;
                // Balanced velocity: 70% logged-day rate, 30% calendar-day rate
                actualVelocity = Math.Round((averagePerLoggedDay * 0.70m) + (progressOverElapsed * 0.30m), 2);
            }
            else
            {
                actualVelocity = 0.00m;
            }

            // Required Velocity (% per day) to finish before DueDate
            decimal requiredVelocity;
            if (remainingCalendarDays > 0)
            {
                requiredVelocity = Math.Round(remainingWorkloadPercent / remainingCalendarDays, 2);
            }
            else
            {
                requiredVelocity = remainingWorkloadPercent; // Overdue / due today
            }

            // Check for open defects count on project
            int openDefectsCount = await _context.TranslationDefects
                .CountAsync(d => d.ProjectId == project.Id && !d.IsResolved);

            // Determine Health Status & Projected Delay
            string healthStatus;
            int projectedDelayDays = 0;

            if (effectiveProgress >= 100.00m || primaryActivity.Status == "Approved" || primaryActivity.Status == "Completed")
            {
                healthStatus = "Completed";
                projectedDelayDays = 0;
            }
            else if (remainingCalendarDays < 0)
            {
                // Due date already passed
                healthStatus = "Delayed";
                projectedDelayDays = Math.Abs(remainingCalendarDays);
            }
            else if (primaryActivity.Status == "Revision Requested" && (openDefectsCount >= 2 || setback >= 15.00m))
            {
                // Serious setback due to review rejection
                healthStatus = "At Risk";
                decimal velocityForCalc = actualVelocity > 0 ? actualVelocity : 10.00m;
                int daysNeeded = (int)Math.Ceiling(remainingWorkloadPercent / velocityForCalc);
                projectedDelayDays = Math.Max(1, daysNeeded - remainingCalendarDays);
            }
            else if (actualVelocity > 0 && actualVelocity < (requiredVelocity * 0.75m))
            {
                // Current pace is significantly lower than required pace
                healthStatus = "At Risk";
                int daysNeeded = (int)Math.Ceiling(remainingWorkloadPercent / actualVelocity);
                projectedDelayDays = Math.Max(1, daysNeeded - remainingCalendarDays);
            }
            else if (remainingCalendarDays <= 3 && remainingWorkloadPercent > 30.00m)
            {
                // 3 days or fewer left with more than 30% work remaining
                healthStatus = "At Risk";
                decimal velocityForCalc = actualVelocity > 0 ? actualVelocity : 12.00m;
                int daysNeeded = (int)Math.Ceiling(remainingWorkloadPercent / velocityForCalc);
                projectedDelayDays = Math.Max(1, daysNeeded - remainingCalendarDays);
            }
            else if (actualVelocity == 0 && elapsedDays >= 2 && remainingWorkloadPercent > 0)
            {
                // Inactive project with no logs after 2+ days
                healthStatus = "At Risk";
                projectedDelayDays = Math.Max(1, (int)Math.Ceiling(remainingWorkloadPercent / 10.00m) - remainingCalendarDays);
            }
            else
            {
                healthStatus = "On Track";
                projectedDelayDays = 0;
            }

            // Update project entity
            project.HealthStatus = healthStatus;
            project.CalculatedVelocity = actualVelocity;
            project.RequiredVelocity = requiredVelocity;
            project.ProjectedDelayDays = projectedDelayDays;
            project.LastStatusSyncAt = DateTime.UtcNow;

            // Story #11 PM Notification: If project is Delayed, alert the Project Manager
            if (healthStatus == "Delayed" && (project.ProjectManagerId > 0))
            {
                bool pmAlertExists = await _context.AlertNotifications.AnyAsync(a =>
                    a.UserId == project.ProjectManagerId &&
                    a.ProjectId == project.Id &&
                    a.AlertType == "ProjectOverdue" &&
                    !a.IsDismissed &&
                    a.CreatedAt >= todayDate);

                if (!pmAlertExists)
                {
                    _context.AlertNotifications.Add(new AlertNotification
                    {
                        UserId = project.ProjectManagerId,
                        ProjectId = project.Id,
                        AlertType = "ProjectOverdue",
                        Severity = "Critical",
                        Title = $"Project Overdue: {project.Name}",
                        Message = $"Project '{project.Name}' is overdue by {projectedDelayDays} day(s) (target due date was {dueDate:dd MMM yyyy}). Please review translator workload and project delivery schedule.",
                        IsDismissed = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            return true;
        }
    }
}
