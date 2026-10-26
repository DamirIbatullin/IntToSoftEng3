// Controllers/ProjectsController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EasyLang.Data;
using EasyLang.Models;
using System.Security.Claims;

namespace EasyLang.Controllers
{
    public class CreateProjectDto
    {
        public long ProjectNumber { get; set; }
        public string Name { get; set; } = string.Empty;
        public int PrimaryTranslatorId { get; set; }
        public string ComplexityLevel { get; set; } = string.Empty;
        public DateTime? DueDate { get; set; }
        public int? LeadChiefEditorId { get; set; }
        public int? BackupChiefEditorId { get; set; }
        public decimal? EstimatedHours { get; set; }
        public decimal? ReviewHours { get; set; }
    }

    public class UpdateReviewDto
    {
        public decimal ReviewHours { get; set; }
    }

    public class ReassignEditorDto
    {
        public int? ChiefEditorId { get; set; }
        public int? SecondaryChiefEditorId { get; set; }
        public string? ReassignmentNote { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class ProjectsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ProjectsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<IActionResult> CreateProject([FromBody] CreateProjectDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int projectManagerId = 1;
            if (userIdClaim != null && int.TryParse(userIdClaim, out int parsedPmId))
            {
                projectManagerId = parsedPmId;
            }

            DateTime? dueDateUtc = null;
            if (dto.DueDate.HasValue)
            {
                dueDateUtc = DateTime.SpecifyKind(dto.DueDate.Value.Date, DateTimeKind.Utc);
            }

            var project = new Project
            {
                ProjectNumber = dto.ProjectNumber,
                Name = dto.Name,
                ProjectManagerId = projectManagerId,
                ChiefEditorId = dto.LeadChiefEditorId,
                SecondaryChiefEditorId = dto.BackupChiefEditorId,
                ComplexityLevel = dto.ComplexityLevel,
                ReviewHours = dto.ReviewHours,
                CreatedAt = DateTime.UtcNow,
                DueDate = dueDateUtc
            };

            _context.Projects.Add(project);
            await _context.SaveChangesAsync();

            string activityName = dto.Name + " - Main Activity";
            if (activityName.Length > 100)
            {
                activityName = activityName.Substring(0, 100);
            }

            var activity = new Activity
            {
                ProjectId = project.Id,
                TranslatorId = dto.PrimaryTranslatorId,
                ActivityNumber = 1,
                Name = activityName,
                PlannedHours = dto.EstimatedHours ?? 0,
                Status = "Pending Start"
            };
            
            _context.Activities.Add(activity);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Project created successfully", projectId = project.Id, activityId = activity.Id });
        }

        [HttpGet]
        public async Task<IActionResult> GetProjects()
        {
            var rawProjects = await _context.Projects.OrderBy(p => p.ProjectNumber).ToListAsync();
            var projectIds = rawProjects.Select(p => p.Id).ToList();

            var activities = await _context.Activities
                .Where(a => projectIds.Contains(a.ProjectId))
                .ToListAsync();

            var primaryActivities = activities
                .GroupBy(a => a.ProjectId)
                .Select(g => g
                    .OrderByDescending(a => a.LastSubmittedAt.HasValue)
                    .ThenByDescending(a => a.LastSubmittedAt)
                    .ThenByDescending(a => a.Status == "Revision Requested" || a.Status == "In Review" || a.Status == "Approved")
                    .ThenBy(a => a.ActivityNumber)
                    .FirstOrDefault())
                .Where(a => a != null)
                .ToDictionary(a => a!.ProjectId, a => a!);

            var activityIds = activities.Select(a => a.Id).ToList();

            // Fetch logs and group in memory to avoid EF Core GroupBy translation errors
            var allDailyLogs = await _context.DailyWorkRecords
                .Where(d => activityIds.Contains(d.ActivityId))
                .ToListAsync();

            var dailyLogsSummary = allDailyLogs
                .GroupBy(d => d.ActivityId)
                .ToDictionary(
                    g => g.Key,
                    g => new
                    {
                        CumulativeProgress = g.Sum(x => x.ProgressPercentage),
                        LogsCount = g.Count()
                    }
                );

            // Fetch defects and estimations safely and group in memory
            var allDefects = new List<TranslationDefect>();
            try
            {
                allDefects = await _context.TranslationDefects
                    .Where(d => projectIds.Contains(d.ProjectId))
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Notice querying TranslationDefects: {ex.Message}");
            }

            var defectsSummary = allDefects
                .GroupBy(d => d.ProjectId)
                .ToDictionary(
                    g => g.Key,
                    g => new
                    {
                        TotalDefects = g.Count(),
                        OpenDefects = g.Count(x => !x.IsResolved)
                    }
                );

            var allEstimations = new List<WeeklyEstimation>();
            try
            {
                allEstimations = await _context.WeeklyEstimations
                    .Where(w => projectIds.Contains(w.ProjectId))
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Notice querying WeeklyEstimations: {ex.Message}");
            }

            var latestEstimations = allEstimations
                .GroupBy(w => w.ProjectId)
                .Select(g => g.OrderByDescending(w => w.SubmissionDate).ThenByDescending(w => w.Id).FirstOrDefault())
                .Where(w => w != null)
                .ToDictionary(w => w!.ProjectId, w => w!);

            var employeesList = await _context.Employees.ToListAsync();
            var employees = employeesList
                .GroupBy(e => e.Id)
                .ToDictionary(g => g.Key, g => g.First().Initials);

            var result = rawProjects.Select(p =>
            {
                primaryActivities.TryGetValue(p.Id, out var act);
                string translatorName = "Unassigned";
                decimal cumulativeProgress = 0.00m;
                int logsCount = 0;

                if (act != null)
                {
                    if (employees.TryGetValue(act.TranslatorId, out var initials))
                    {
                        translatorName = initials;
                    }

                    if (dailyLogsSummary.TryGetValue(act.Id, out var sum))
                    {
                        cumulativeProgress = Math.Min(100.00m, Math.Round(sum.CumulativeProgress, 2));
                        logsCount = sum.LogsCount;
                    }
                }

                // Resolve status considering Sprint 3 editorial workflow states
                string status;
                if (act != null && (act.Status == "In Review" || act.Status == "Revision Requested" || act.Status == "Approved"))
                {
                    status = act.Status;
                }
                else if (cumulativeProgress >= 100.00m)
                {
                    status = "Completed";
                }
                else if (logsCount > 0 || (act != null && act.Status == "In Progress"))
                {
                    status = "On Track";
                }
                else
                {
                    status = "Pending Start";
                }

                string chiefEditorInitials = p.ChiefEditorId.HasValue && employees.TryGetValue(p.ChiefEditorId.Value, out var ceInit)
                    ? ceInit
                    : "DD";

                string? secondaryEditorInitials = p.SecondaryChiefEditorId.HasValue && employees.TryGetValue(p.SecondaryChiefEditorId.Value, out var secInit)
                    ? secInit
                    : null;

                defectsSummary.TryGetValue(p.Id, out var defSum);
                latestEstimations.TryGetValue(p.Id, out var latestEst);

                decimal plannedTotal = (act != null && act.PlannedHours > 0) ? act.PlannedHours : 28.0m;
                decimal autoRemaining = Math.Round(plannedTotal * (Math.Max(0m, 100.00m - cumulativeProgress) / 100.00m) * 2.0m, MidpointRounding.AwayFromZero) / 2.0m;
                decimal? remainingHoursEst = act?.RemainingHoursEstimate ?? latestEst?.RemainingHours ?? autoRemaining;
                string? attachmentName = act?.LatestAttachmentName ?? latestEst?.AttachmentFileName;
                string? attachmentType = act?.LatestAttachmentType ?? latestEst?.AttachmentFileType;
                DateTime? lastSubmitted = act?.LastSubmittedAt ?? latestEst?.CreatedAt;

                return new
                {
                    projectId = p.Id,
                    activityId = act?.Id ?? 0,
                    id = p.ProjectNumber,
                    name = p.Name,
                    translator = translatorName,
                    translatorId = act?.TranslatorId ?? 0,
                    chiefEditorId = p.ChiefEditorId ?? 3,
                    chiefEditor = chiefEditorInitials,
                    secondaryChiefEditorId = p.SecondaryChiefEditorId,
                    secondaryChiefEditor = secondaryEditorInitials,
                    reassignmentNote = p.ReassignmentNote,
                    reassignedAt = p.ReassignedAt.HasValue ? p.ReassignedAt.Value.ToString("yyyy-MM-dd HH:mm") : null,
                    complexity = p.ComplexityLevel,
                    reviewHours = p.ReviewHours,
                    plannedHours = plannedTotal,
                    remainingHoursEstimate = remainingHoursEst,
                    progress = cumulativeProgress,
                    logsCount = logsCount,
                    status = status,
                    attachmentName = attachmentName,
                    attachmentType = attachmentType,
                    lastSubmittedAt = lastSubmitted.HasValue ? lastSubmitted.Value.ToString("yyyy-MM-dd") : null,
                    defectsCount = defSum?.TotalDefects ?? 0,
                    openDefectsCount = defSum?.OpenDefects ?? 0,
                    createdAt = p.CreatedAt.HasValue ? p.CreatedAt.Value.ToString("yyyy-MM-dd") : null,
                    dueDate = p.DueDate.HasValue ? p.DueDate.Value.ToString("yyyy-MM-dd") : null
                };
            }).ToList();

            return Ok(result);
        }

        [Microsoft.AspNetCore.Authorization.Authorize]
        [HttpPut("{id}/review")]
        public async Task<IActionResult> UpdateReviewMetrics(int id, [FromBody] UpdateReviewDto dto)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound(new { error = "Project not found" });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            int.TryParse(userIdClaim, out int currentUserId);

            // Story #8: Allow Lead Chief Editor, Secondary Chief Editor, or Project Manager / Admin
            if (userRole == "Chief Editor" &&
                project.ChiefEditorId != null &&
                project.ChiefEditorId != currentUserId &&
                project.SecondaryChiefEditorId != currentUserId)
            {
                return Forbid();
            }

            project.ReviewHours = dto.ReviewHours;

            if (project.ChiefEditorId == null && currentUserId > 0)
            {
                project.ChiefEditorId = currentUserId;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Review metrics updated successfully", reviewHours = project.ReviewHours });
        }

        // =========================================================================
        // STORY #8: Reassign Editors & Update Secondary Editor Database Permissions
        // =========================================================================
        [Microsoft.AspNetCore.Authorization.Authorize]
        [HttpPut("{id}/reassign-editor")]
        public async Task<IActionResult> ReassignEditor(int id, [FromBody] ReassignEditorDto dto)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null)
            {
                return NotFound(new { error = "Project not found" });
            }

            if (dto.ChiefEditorId.HasValue && dto.ChiefEditorId.Value > 0)
            {
                project.ChiefEditorId = dto.ChiefEditorId.Value;
            }

            if (dto.SecondaryChiefEditorId.HasValue && dto.SecondaryChiefEditorId.Value > 0)
            {
                if (dto.SecondaryChiefEditorId.Value == project.ChiefEditorId)
                {
                    return BadRequest(new { error = "Secondary Chief Editor must be different from the Lead Chief Editor." });
                }
                project.SecondaryChiefEditorId = dto.SecondaryChiefEditorId.Value;
            }
            else
            {
                project.SecondaryChiefEditorId = null;
            }

            project.ReassignmentNote = dto.ReassignmentNote?.Trim();
            project.ReassignedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Update database permissions table ("ProjectEditorAccess") for primary and secondary editors
            try
            {
                if (project.ChiefEditorId.HasValue)
                {
                    await _context.Database.ExecuteSqlRawAsync(@"
                        INSERT INTO ""ProjectEditorAccess"" (project_id, editor_id, access_level, can_review, can_log_defects, can_toggle_status)
                        VALUES ({0}, {1}, 'Primary', TRUE, TRUE, TRUE)
                        ON CONFLICT (project_id, editor_id) DO UPDATE SET access_level = 'Primary', can_review = TRUE, can_log_defects = TRUE, can_toggle_status = TRUE;
                    ", project.Id, project.ChiefEditorId.Value);
                }

                if (project.SecondaryChiefEditorId.HasValue)
                {
                    await _context.Database.ExecuteSqlRawAsync(@"
                        INSERT INTO ""ProjectEditorAccess"" (project_id, editor_id, access_level, can_review, can_log_defects, can_toggle_status)
                        VALUES ({0}, {1}, 'Secondary', TRUE, TRUE, TRUE)
                        ON CONFLICT (project_id, editor_id) DO UPDATE SET access_level = 'Secondary', can_review = TRUE, can_log_defects = TRUE, can_toggle_status = TRUE;
                    ", project.Id, project.SecondaryChiefEditorId.Value);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ProjectEditorAccess sync notice: {ex.Message}");
            }

            var employeesList = await _context.Employees
                .Where(e => e.Id == project.ChiefEditorId || e.Id == project.SecondaryChiefEditorId)
                .ToListAsync();
            var employees = employeesList.GroupBy(e => e.Id).ToDictionary(g => g.Key, g => g.First().Initials);

            string leadInitials = project.ChiefEditorId.HasValue && employees.TryGetValue(project.ChiefEditorId.Value, out var lInit) ? lInit : "DD";
            string? secInitials = project.SecondaryChiefEditorId.HasValue && employees.TryGetValue(project.SecondaryChiefEditorId.Value, out var sInit) ? sInit : null;

            return Ok(new
            {
                message = secInitials != null
                    ? $"Assigned {secInitials} as temporary secondary Chief Editor alongside {leadInitials}."
                    : $"Updated Lead Chief Editor to {leadInitials}.",
                projectId = project.Id,
                chiefEditorId = project.ChiefEditorId,
                chiefEditor = leadInitials,
                secondaryChiefEditorId = project.SecondaryChiefEditorId,
                secondaryChiefEditor = secInitials,
                reassignmentNote = project.ReassignmentNote,
                reassignedAt = project.ReassignedAt.Value.ToString("yyyy-MM-dd HH:mm")
            });
        }

        [Microsoft.AspNetCore.Authorization.Authorize]
        [HttpGet("{id}/review-details")]
        public async Task<IActionResult> GetProjectReviewDetails(int id)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound(new { error = "Project not found" });

            var projectActivities = await _context.Activities
                .Where(a => a.ProjectId == id)
                .ToListAsync();

            var activity = projectActivities
                .OrderByDescending(a => a.LastSubmittedAt.HasValue)
                .ThenByDescending(a => a.LastSubmittedAt)
                .ThenByDescending(a => a.Status == "Revision Requested" || a.Status == "In Review" || a.Status == "Approved")
                .ThenBy(a => a.ActivityNumber)
                .FirstOrDefault();

            if (activity == null)
            {
                return NotFound(new { error = "Primary activity not found for this project" });
            }

            var estimations = new List<WeeklyEstimation>();
            try
            {
                estimations = await _context.WeeklyEstimations
                    .Where(w => w.ProjectId == id)
                    .OrderByDescending(w => w.SubmissionDate)
                    .ThenByDescending(w => w.Id)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Notice querying WeeklyEstimations in details: {ex.Message}");
            }

            var defectsRaw = new List<TranslationDefect>();
            try
            {
                defectsRaw = await _context.TranslationDefects
                    .Where(d => d.ProjectId == id)
                    .OrderByDescending(d => d.CreatedAt)
                    .ThenByDescending(d => d.Id)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Notice querying TranslationDefects in details: {ex.Message}");
            }

            var editorIds = defectsRaw.Select(d => d.EditorId).Distinct().ToList();
            var editorsList = await _context.Employees
                .Where(e => editorIds.Contains(e.Id))
                .ToListAsync();
            var editors = editorsList.GroupBy(e => e.Id).ToDictionary(g => g.Key, g => g.First().Initials);

            var defects = defectsRaw.Select(d => new
            {
                id = d.Id,
                activityId = d.ActivityId,
                projectId = d.ProjectId,
                editorId = d.EditorId,
                editorInitials = editors.TryGetValue(d.EditorId, out var init) ? init : "CE",
                errorCategory = d.ErrorCategory,
                severity = d.Severity,
                locationReference = d.LocationReference,
                revisionComment = d.RevisionComment,
                isResolved = d.IsResolved,
                createdAt = d.CreatedAt
            }).ToList();

            return Ok(new
            {
                projectId = project.Id,
                projectNumber = project.ProjectNumber,
                projectName = project.Name,
                activityId = activity.Id,
                activityName = activity.Name,
                status = activity.Status ?? "Pending Start",
                remainingHoursEstimate = activity.RemainingHoursEstimate,
                reviewHours = project.ReviewHours,
                latestAttachmentName = activity.LatestAttachmentName,
                latestAttachmentType = activity.LatestAttachmentType,
                lastSubmittedAt = activity.LastSubmittedAt,
                estimations = estimations.Select(w => new
                {
                    id = w.Id,
                    remainingHours = w.RemainingHours,
                    remainingPercentage = w.RemainingPercentage,
                    completedProgress = w.CompletedProgress,
                    completedText = w.CompletedText,
                    attachmentFileName = w.AttachmentFileName,
                    attachmentFileType = w.AttachmentFileType,
                    submittedForReview = w.SubmittedForReview,
                    submissionDate = w.SubmissionDate.ToString("yyyy-MM-dd"),
                    createdAt = w.CreatedAt
                }),
                defects = defects
            });
        }

        [Microsoft.AspNetCore.Authorization.Authorize]
        [HttpGet("my-activities")]
        public async Task<IActionResult> GetMyActivities([FromQuery] string? search = null)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int translatorId))
            {
                return Unauthorized();
            }

            var rawActivities = await (from a in _context.Activities
                                    where a.TranslatorId == translatorId
                                    join p in _context.Projects on a.ProjectId equals p.Id
                                    select new
                                    {
                                        activityId = a.Id,
                                        activityNumber = a.ActivityNumber,
                                        activityName = a.Name,
                                        projectId = p.Id,
                                        projectName = p.Name,
                                        projectNumber = p.ProjectNumber,
                                        plannedHours = a.PlannedHours,
                                        complexity = p.ComplexityLevel,
                                        status = a.Status,
                                        remainingHoursEstimate = a.RemainingHoursEstimate,
                                        lastSubmittedAt = a.LastSubmittedAt,
                                        latestAttachmentName = a.LatestAttachmentName,
                                        latestAttachmentType = a.LatestAttachmentType
                                    }).ToListAsync();

            var activityIds = rawActivities.Select(a => a.activityId).ToList();

            // Fetch daily logs and group in memory to avoid EF Core GroupBy translation errors
            var allLogs = await _context.DailyWorkRecords
                .Where(d => activityIds.Contains(d.ActivityId))
                .ToListAsync();

            var dailyLogsSummary = allLogs
                .GroupBy(d => d.ActivityId)
                .ToDictionary(
                    g => g.Key,
                    g => new
                    {
                        CumulativeProgress = g.Sum(x => x.ProgressPercentage),
                        LatestLogDate = g.Max(x => x.LogDate),
                        LogsCount = g.Count()
                    }
                );

            var allDefects = new List<TranslationDefect>();
            try
            {
                allDefects = await _context.TranslationDefects
                    .Where(d => activityIds.Contains(d.ActivityId))
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Notice querying TranslationDefects in my-activities: {ex.Message}");
            }

            var defectsByActivity = allDefects
                .GroupBy(d => d.ActivityId)
                .ToDictionary(
                    g => g.Key,
                    g => new
                    {
                        TotalDefects = g.Count(),
                        OpenDefects = g.Count(x => !x.IsResolved),
                        LatestComment = g.OrderByDescending(x => x.CreatedAt).Select(x => x.RevisionComment).FirstOrDefault()
                    }
                );

            var enrichedActivities = rawActivities.Select(a =>
            {
                dailyLogsSummary.TryGetValue(a.activityId, out var summary);
                defectsByActivity.TryGetValue(a.activityId, out var defectInfo);

                decimal progress = summary != null ? Math.Min(100.00m, Math.Round(summary.CumulativeProgress, 2)) : 0.00m;
                string? latestDate = summary?.LatestLogDate.ToString("yyyy-MM-dd");
                int logsCount = summary?.LogsCount ?? 0;

                string resolvedStatus;
                if (a.status == "In Review" || a.status == "Revision Requested" || a.status == "Approved")
                {
                    resolvedStatus = a.status;
                }
                else if (progress >= 100.00m)
                {
                    resolvedStatus = "Completed";
                }
                else if (logsCount > 0 || a.status == "In Progress")
                {
                    resolvedStatus = "In Progress";
                }
                else
                {
                    resolvedStatus = "Work entry missing";
                }

                decimal plannedTotal = a.plannedHours > 0 ? a.plannedHours : 28.0m;
                decimal autoRemaining = Math.Round(plannedTotal * (Math.Max(0m, 100.00m - progress) / 100.00m) * 2.0m, MidpointRounding.AwayFromZero) / 2.0m;
                decimal resolvedRemainingHours = a.remainingHoursEstimate ?? autoRemaining;

                return new
                {
                    activityId = a.activityId,
                    activityNumber = a.activityNumber,
                    activityName = a.activityName,
                    projectId = a.projectId,
                    projectName = a.projectName,
                    projectNumber = a.projectNumber,
                    plannedHours = plannedTotal,
                    complexity = a.complexity,
                    status = resolvedStatus,
                    remainingHoursEstimate = resolvedRemainingHours,
                    lastSubmittedAt = a.lastSubmittedAt.HasValue ? a.lastSubmittedAt.Value.ToString("yyyy-MM-dd HH:mm") : null,
                    latestAttachmentName = a.latestAttachmentName,
                    latestAttachmentType = a.latestAttachmentType,
                    defectsCount = defectInfo?.TotalDefects ?? 0,
                    openDefectsCount = defectInfo?.OpenDefects ?? 0,
                    latestDefectComment = defectInfo?.LatestComment,
                    cumulativeProgress = progress,
                    latestLogDate = latestDate,
                    logsCount = logsCount
                };
            }).ToList();

            if (string.IsNullOrWhiteSpace(search))
            {
                return Ok(enrichedActivities);
            }

            // Fuzzy matching algorithm for activity queries
            string query = search.Trim().ToLowerInvariant().TrimStart('#');
            var matched = enrichedActivities
                .Select(a =>
                {
                    double score = CalculateFuzzyScore(a.projectNumber.ToString(), a.projectName, a.activityName, query);
                    return new { Activity = a, Score = score };
                })
                .Where(x => x.Score > 0.25)
                .OrderByDescending(x => x.Score)
                .Select(x => x.Activity)
                .ToList();

            return Ok(matched);
        }

        private static double CalculateFuzzyScore(string projectNumber, string projectName, string activityName, string query)
        {
            if (string.IsNullOrWhiteSpace(query)) return 1.0;

            string pNum = projectNumber.ToLowerInvariant();
            string pName = (projectName ?? "").ToLowerInvariant();
            string aName = (activityName ?? "").ToLowerInvariant();

            // Direct exact match
            if (pNum == query || pName == query || aName == query)
                return 1.0;

            // Project number prefix or substring
            if (pNum.Contains(query))
                return 0.95;

            // Direct contains match
            if (pName.Contains(query) || aName.Contains(query))
                return 0.85;

            // Multi-token match: all words in query appear in target
            var queryTokens = query.Split(new[] { ' ', '-', '_' }, StringSplitOptions.RemoveEmptyEntries);
            if (queryTokens.Length > 1)
            {
                bool allTokensInProject = queryTokens.All(t => pName.Contains(t) || pNum.Contains(t));
                if (allTokensInProject) return 0.80;
            }

            // Fuzzy Levenshtein similarity on words
            var allWords = $"{pNum} {pName} {aName}".Split(new[] { ' ', '-', '_', '.', ',' }, StringSplitOptions.RemoveEmptyEntries);
            double bestTokenScore = 0.0;

            foreach (var word in allWords)
            {
                if (word.StartsWith(query))
                {
                    bestTokenScore = Math.Max(bestTokenScore, 0.75);
                    continue;
                }

                int dist = ComputeLevenshteinDistance(word, query);
                int maxLen = Math.Max(word.Length, query.Length);
                if (maxLen > 0)
                {
                    double sim = 1.0 - ((double)dist / maxLen);
                    if (sim > bestTokenScore)
                    {
                        bestTokenScore = sim;
                    }
                }
            }

            return bestTokenScore;
        }

        private static int ComputeLevenshteinDistance(string s1, string s2)
        {
            if (string.IsNullOrEmpty(s1)) return s2?.Length ?? 0;
            if (string.IsNullOrEmpty(s2)) return s1.Length;

            int[,] d = new int[s1.Length + 1, s2.Length + 1];

            for (int i = 0; i <= s1.Length; i++) d[i, 0] = i;
            for (int j = 0; j <= s2.Length; j++) d[0, j] = j;

            for (int i = 1; i <= s1.Length; i++)
            {
                for (int j = 1; j <= s2.Length; j++)
                {
                    int cost = (s1[i - 1] == s2[j - 1]) ? 0 : 1;
                    d[i, j] = Math.Min(
                        Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                        d[i - 1, j - 1] + cost);
                }
            }

            return d[s1.Length, s2.Length];
        }
    }
}
