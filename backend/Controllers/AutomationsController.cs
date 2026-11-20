// Controllers/AutomationsController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using EasyLang.Data;
using EasyLang.Models;
using EasyLang.Services;
using System.Security.Claims;

namespace EasyLang.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AutomationsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AutomationsService _automationsService;

        public AutomationsController(AppDbContext context, AutomationsService automationsService)
        {
            _context = context;
            _automationsService = automationsService;
        }

        // =========================================================================
        // STORY #10: Notification Badges & In-App Alerts
        // =========================================================================

        [HttpGet("alerts")]
        public async Task<IActionResult> GetAlerts()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int currentUserId))
            {
                return Unauthorized(new { error = "User identity not verified." });
            }

            var query = _context.AlertNotifications.Where(a => a.UserId == currentUserId);

            // Project access scoping based on role:
            // 1. Translators ONLY receive alerts for projects & activities they are actively assigned to / have access to
            if (userRole == "Translator")
            {
                var accessibleProjectIds = await _context.Activities
                    .Where(a => a.TranslatorId == currentUserId)
                    .Select(a => a.ProjectId)
                    .Distinct()
                    .ToListAsync();

                var accessibleActivityIds = await _context.Activities
                    .Where(a => a.TranslatorId == currentUserId)
                    .Select(a => a.Id)
                    .ToListAsync();

                query = query.Where(a =>
                    a.ProjectId != null && accessibleProjectIds.Contains(a.ProjectId.Value) &&
                    (a.ActivityId == null || accessibleActivityIds.Contains(a.ActivityId.Value))
                );
            }
            // 2. Chief Editors ONLY receive alerts for projects they review or supervise
            else if (userRole == "Chief Editor")
            {
                var accessibleProjectIds = await _context.Projects
                    .Where(p => p.ChiefEditorId == currentUserId || p.SecondaryChiefEditorId == currentUserId)
                    .Select(p => p.Id)
                    .Distinct()
                    .ToListAsync();

                query = query.Where(a =>
                    a.ProjectId == null || accessibleProjectIds.Contains(a.ProjectId.Value)
                );
            }

            var alerts = await query
                .OrderByDescending(a => a.CreatedAt)
                .Take(50)
                .Select(a => new
                {
                    id = a.Id,
                    userId = a.UserId,
                    projectId = a.ProjectId,
                    activityId = a.ActivityId,
                    alertType = a.AlertType,
                    severity = a.Severity,
                    title = a.Title,
                    message = a.Message,
                    isDismissed = a.IsDismissed,
                    createdAt = a.CreatedAt
                })
                .ToListAsync();

            int unreadCount = alerts.Count(a => !a.isDismissed);

            return Ok(new
            {
                totalAlerts = alerts.Count,
                unreadCount = unreadCount,
                alerts = alerts
            });
        }

        [HttpGet("alerts/unread-count")]
        public async Task<IActionResult> GetUnreadAlertsCount()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int currentUserId))
            {
                return Unauthorized(new { error = "User identity not verified." });
            }

            var query = _context.AlertNotifications.Where(a => !a.IsDismissed && a.UserId == currentUserId);

            if (userRole == "Translator")
            {
                var accessibleProjectIds = await _context.Activities
                    .Where(a => a.TranslatorId == currentUserId)
                    .Select(a => a.ProjectId)
                    .Distinct()
                    .ToListAsync();

                var accessibleActivityIds = await _context.Activities
                    .Where(a => a.TranslatorId == currentUserId)
                    .Select(a => a.Id)
                    .ToListAsync();

                query = query.Where(a =>
                    a.ProjectId != null && accessibleProjectIds.Contains(a.ProjectId.Value) &&
                    (a.ActivityId == null || accessibleActivityIds.Contains(a.ActivityId.Value))
                );
            }
            else if (userRole == "Chief Editor")
            {
                var accessibleProjectIds = await _context.Projects
                    .Where(p => p.ChiefEditorId == currentUserId || p.SecondaryChiefEditorId == currentUserId)
                    .Select(p => p.Id)
                    .Distinct()
                    .ToListAsync();

                query = query.Where(a =>
                    a.ProjectId == null || accessibleProjectIds.Contains(a.ProjectId.Value)
                );
            }

            int count = await query.CountAsync();

            return Ok(new { unreadCount = count });
        }

        [HttpPost("alerts/{id}/dismiss")]
        public async Task<IActionResult> DismissAlert(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var alert = await _context.AlertNotifications.FindAsync(id);
            if (alert == null)
            {
                return NotFound(new { error = "Alert notification not found." });
            }

            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int currentUserId) && alert.UserId != currentUserId)
            {
                return Forbid();
            }

            alert.IsDismissed = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Alert dismissed successfully.", id = id });
        }

        [HttpPost("alerts/dismiss-all")]
        public async Task<IActionResult> DismissAllAlerts()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int currentUserId))
            {
                return Unauthorized(new { error = "User identity not verified." });
            }

            var query = _context.AlertNotifications.Where(a => a.UserId == currentUserId && !a.IsDismissed);

            if (userRole == "Translator")
            {
                var accessibleProjectIds = await _context.Activities
                    .Where(a => a.TranslatorId == currentUserId)
                    .Select(a => a.ProjectId)
                    .Distinct()
                    .ToListAsync();

                var accessibleActivityIds = await _context.Activities
                    .Where(a => a.TranslatorId == currentUserId)
                    .Select(a => a.Id)
                    .ToListAsync();

                query = query.Where(a =>
                    a.ProjectId != null && accessibleProjectIds.Contains(a.ProjectId.Value) &&
                    (a.ActivityId == null || accessibleActivityIds.Contains(a.ActivityId.Value))
                );
            }
            else if (userRole == "Chief Editor")
            {
                var accessibleProjectIds = await _context.Projects
                    .Where(p => p.ChiefEditorId == currentUserId || p.SecondaryChiefEditorId == currentUserId)
                    .Select(p => p.Id)
                    .Distinct()
                    .ToListAsync();

                query = query.Where(a =>
                    a.ProjectId == null || accessibleProjectIds.Contains(a.ProjectId.Value)
                );
            }

            var alerts = await query.ToListAsync();

            foreach (var a in alerts)
            {
                a.IsDismissed = true;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "All alerts marked as dismissed.", count = alerts.Count });
        }

        // =========================================================================
        // AUTOMATION CRON / TRIGGER ENDPOINTS (Story #10 & Story #11)
        // =========================================================================

        [HttpPost("trigger-missing-log-check")]
        public async Task<IActionResult> TriggerMissingLogCheck()
        {
            int alertsCreated = await _automationsService.RunMissingLogsCheckAsync();
            return Ok(new
            {
                message = $"End-of-day missing log automation completed successfully. Generated {alertsCreated} alerts.",
                alertsCreated = alertsCreated,
                executedAt = DateTime.UtcNow
            });
        }

        [HttpPost("sync-project-statuses")]
        public async Task<IActionResult> SyncProjectStatuses()
        {
            int projectsSynced = await _automationsService.SynchronizeAllProjectStatusesAsync();
            return Ok(new
            {
                message = $"Automated velocity calculation & health status sync completed for {projectsSynced} projects.",
                projectsSynced = projectsSynced,
                executedAt = DateTime.UtcNow
            });
        }

        [HttpGet("missing-logs-summary")]
        public async Task<IActionResult> GetMissingLogsSummary()
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            var activeActivities = await _context.Activities
                .Where(a => a.Status != "Approved" && a.Status != "Completed")
                .ToListAsync();

            var activityIds = activeActivities.Select(a => a.Id).ToList();

            var todaysLogs = await _context.DailyWorkRecords
                .Where(d => activityIds.Contains(d.ActivityId) && d.LogDate == today)
                .Select(d => d.ActivityId)
                .Distinct()
                .ToListAsync();

            var missingActivities = activeActivities
                .Where(a => !todaysLogs.Contains(a.Id))
                .ToList();

            var missingProjectIds = missingActivities.Select(a => a.ProjectId).Distinct().ToList();
            var projects = await _context.Projects
                .Where(p => missingProjectIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p);

            var missingTranslatorIds = missingActivities.Select(a => a.TranslatorId).Distinct().ToList();
            var translators = await _context.Employees
                .Where(e => missingTranslatorIds.Contains(e.Id))
                .ToDictionaryAsync(e => e.Id, e => e.Initials);

            var summary = missingActivities.Select(a =>
            {
                projects.TryGetValue(a.ProjectId, out var project);
                translators.TryGetValue(a.TranslatorId, out var translatorInitials);

                return new
                {
                    activityId = a.Id,
                    projectId = a.ProjectId,
                    projectNumber = project?.ProjectNumber ?? 0,
                    projectName = project?.Name ?? "Unknown Project",
                    translatorId = a.TranslatorId,
                    translatorInitials = translatorInitials ?? "TR",
                    plannedHours = a.PlannedHours,
                    status = a.Status
                };
            }).ToList();

            return Ok(new
            {
                totalActiveActivities = activeActivities.Count,
                missingTodayCount = summary.Count,
                missingTranslatorsCount = summary.Select(s => s.translatorId).Distinct().Count(),
                missingEntries = summary
            });
        }
    }
}
