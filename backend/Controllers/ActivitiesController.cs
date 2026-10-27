// Controllers/ActivitiesController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using EasyLang.Data;
using EasyLang.Models;
using System.Security.Claims;

namespace EasyLang.Controllers
{
    public class CreateDailyLogDto
    {
        public decimal ProgressPercentage { get; set; }
        public decimal? PagesTranslated { get; set; }
        public decimal? HoursSpent { get; set; }
        public string? LogDate { get; set; }
        public string? Notes { get; set; }
    }

    public class CreateWeeklyEstimationDto
    {
        public decimal RemainingHours { get; set; }
        public decimal? RemainingPercentage { get; set; }
        public string? CompletedText { get; set; }
        public string? AttachmentFileName { get; set; }
        public string? AttachmentFileType { get; set; }
        public int? AttachmentFileSize { get; set; }
        public bool SubmitForReview { get; set; } = true;
        public string? SubmissionDate { get; set; }
    }

    public class CreateDefectDto
    {
        public string ErrorCategory { get; set; } = "Terminology";
        public string Severity { get; set; } = "Major";
        public string? LocationReference { get; set; }
        public string RevisionComment { get; set; } = string.Empty;
        public bool SendBackToTranslator { get; set; } = true;
    }

    public class UpdateReviewStatusDto
    {
        public string Status { get; set; } = "In Review";
        public string? RevisionComment { get; set; }
        public string? ErrorCategory { get; set; }
        public string? Severity { get; set; }
        public string? LocationReference { get; set; }
    }

    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ActivitiesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ActivitiesController(AppDbContext context)
        {
            _context = context;
        }

        private async Task<bool> HasEditorAccessAsync(int projectId, int userId, string? userRole)
        {
            if (userRole == "Project Manager" || userRole == "Admin")
                return true;

            if (userRole != "Chief Editor")
                return false;

            var project = await _context.Projects.FindAsync(projectId);
            if (project == null) return false;

            // Allow Lead Chief Editor, Secondary Chief Editor, or unassigned project
            if (project.ChiefEditorId == null || project.ChiefEditorId == userId || project.SecondaryChiefEditorId == userId)
                return true;

            return false;
        }

        [HttpPost("{id}/daily-logs")]
        public async Task<IActionResult> LogDailyProgress(int id, [FromBody] CreateDailyLogDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int translatorId))
            {
                return Unauthorized(new { error = "User identity not verified" });
            }

            var activity = await _context.Activities.FindAsync(id);
            if (activity == null)
            {
                return NotFound(new { error = "Activity not found" });
            }

            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            if (activity.TranslatorId != translatorId && userRole != "Project Manager" && userRole != "Admin")
            {
                return Forbid();
            }

            // Two-decimal precision validation
            decimal roundedPercentage = Math.Round(dto.ProgressPercentage, 2);
            if (roundedPercentage <= 0.00m || roundedPercentage > 100.00m)
            {
                return BadRequest(new { error = "Daily progress percentage must be between 0.01% and 100.00%." });
            }

            // Check current cumulative progress
            var currentTotal = await _context.DailyWorkRecords
                .Where(d => d.ActivityId == id)
                .SumAsync(d => (decimal?)d.ProgressPercentage) ?? 0m;

            if (currentTotal + roundedPercentage > 100.00m)
            {
                decimal remaining = Math.Max(0m, 100.00m - currentTotal);
                return BadRequest(new
                {
                    error = $"Cumulative progress cannot exceed 100.00%. Currently completed: {currentTotal:F2}%. Remaining allowed: {remaining:F2}%."
                });
            }

            DateOnly recordDate = DateOnly.FromDateTime(DateTime.UtcNow);
            if (!string.IsNullOrWhiteSpace(dto.LogDate) && DateOnly.TryParse(dto.LogDate, out DateOnly parsedDate))
            {
                recordDate = parsedDate;
            }

            var dailyLog = new DailyWorkRecord
            {
                ActivityId = id,
                TranslatorId = translatorId,
                LogDate = recordDate,
                ProgressPercentage = roundedPercentage,
                PagesTranslated = dto.PagesTranslated.HasValue ? Math.Round(dto.PagesTranslated.Value, 2) : null,
                HoursSpent = dto.HoursSpent.HasValue ? Math.Round(dto.HoursSpent.Value, 2) : null,
                Notes = dto.Notes?.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            _context.DailyWorkRecords.Add(dailyLog);

            decimal newCumulative = Math.Min(100.00m, currentTotal + roundedPercentage);
            decimal remainingPercentage = Math.Max(0.00m, 100.00m - newCumulative);
            decimal estimatedTotalHours = activity.PlannedHours > 0 ? activity.PlannedHours : 28.0m;

            // Automatically recalculate remaining hours estimate proportionally to the initial estimated total, rounded to nearest 0.5h
            activity.RemainingHoursEstimate = Math.Round(estimatedTotalHours * (remainingPercentage / 100.00m) * 2.0m, MidpointRounding.AwayFromZero) / 2.0m;

            if (string.IsNullOrEmpty(activity.Status) || activity.Status == "Pending Start")
            {
                activity.Status = newCumulative >= 100.00m ? "Completed" : "In Progress";
            }
            else if (newCumulative >= 100.00m && activity.Status != "In Review" && activity.Status != "Revision Requested")
            {
                activity.Status = "Completed";
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Daily progress logged successfully.",
                log = new
                {
                    id = dailyLog.Id,
                    activityId = dailyLog.ActivityId,
                    logDate = dailyLog.LogDate.ToString("yyyy-MM-dd"),
                    progressPercentage = dailyLog.ProgressPercentage,
                    pagesTranslated = dailyLog.PagesTranslated,
                    hoursSpent = dailyLog.HoursSpent,
                    notes = dailyLog.Notes,
                    createdAt = dailyLog.CreatedAt
                },
                cumulativeProgress = newCumulative,
                remainingPercentage = remainingPercentage,
                plannedHours = estimatedTotalHours,
                remainingHoursEstimate = activity.RemainingHoursEstimate,
                status = activity.Status
            });
        }

        [HttpGet("{id}/daily-logs")]
        public async Task<IActionResult> GetDailyLogs(int id)
        {
            var activity = await _context.Activities.FindAsync(id);
            if (activity == null)
            {
                return NotFound(new { error = "Activity not found" });
            }

            var logs = await _context.DailyWorkRecords
                .Where(d => d.ActivityId == id)
                .OrderByDescending(d => d.LogDate)
                .ThenByDescending(d => d.Id)
                .Select(d => new
                {
                    id = d.Id,
                    activityId = d.ActivityId,
                    logDate = d.LogDate.ToString("yyyy-MM-dd"),
                    progressPercentage = d.ProgressPercentage,
                    pagesTranslated = d.PagesTranslated,
                    hoursSpent = d.HoursSpent,
                    notes = d.Notes,
                    createdAt = d.CreatedAt
                })
                .ToListAsync();

            decimal cumulative = Math.Min(100.00m, logs.Sum(l => l.progressPercentage));
            decimal remainingPct = Math.Max(0.00m, 100.00m - cumulative);
            decimal estimatedTotalHours = activity.PlannedHours > 0 ? activity.PlannedHours : 28.0m;
            decimal autoRemainingHours = Math.Round(estimatedTotalHours * (remainingPct / 100.00m) * 2.0m, MidpointRounding.AwayFromZero) / 2.0m;

            return Ok(new
            {
                activityId = id,
                activityName = activity.Name,
                status = activity.Status ?? "Pending Start",
                plannedHours = estimatedTotalHours,
                remainingHoursEstimate = activity.RemainingHoursEstimate ?? autoRemainingHours,
                cumulativeProgress = cumulative,
                remainingPercentage = remainingPct,
                totalLogsCount = logs.Count,
                logs = logs
            });
        }

        [HttpDelete("{id}/daily-logs/{logId}")]
        public async Task<IActionResult> DeleteDailyLog(int id, int logId)
        {
            var log = await _context.DailyWorkRecords.FirstOrDefaultAsync(d => d.Id == logId && d.ActivityId == id);
            if (log == null)
            {
                return NotFound(new { error = "Daily log not found" });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            if (int.TryParse(userIdClaim, out int currentUserId) && (log.TranslatorId == currentUserId || userRole == "Project Manager" || userRole == "Admin"))
            {
                _context.DailyWorkRecords.Remove(log);
                await _context.SaveChangesAsync();

                var newTotal = Math.Min(100.00m, await _context.DailyWorkRecords
                    .Where(d => d.ActivityId == id)
                    .SumAsync(d => (decimal?)d.ProgressPercentage) ?? 0m);

                var activity = await _context.Activities.FindAsync(id);
                decimal estimatedTotalHours = (activity != null && activity.PlannedHours > 0) ? activity.PlannedHours : 28.0m;
                decimal remainingPct = Math.Max(0.00m, 100.00m - newTotal);
                decimal updatedRemainingHours = Math.Round(estimatedTotalHours * (remainingPct / 100.00m) * 2.0m, MidpointRounding.AwayFromZero) / 2.0m;

                if (activity != null)
                {
                    activity.RemainingHoursEstimate = updatedRemainingHours;
                    await _context.SaveChangesAsync();
                }

                return Ok(new
                {
                    message = "Daily log removed successfully.",
                    cumulativeProgress = newTotal,
                    remainingPercentage = remainingPct,
                    plannedHours = estimatedTotalHours,
                    remainingHoursEstimate = updatedRemainingHours
                });
            }

            return Forbid();
        }

        // =========================================================================
        // STORY #6: Weekly Estimation & Friday Review Submission
        // =========================================================================

        [HttpPost("{id}/weekly-estimations")]
        public async Task<IActionResult> SubmitWeeklyEstimation(int id, [FromBody] CreateWeeklyEstimationDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int translatorId))
            {
                return Unauthorized(new { error = "User identity not verified" });
            }

            var activity = await _context.Activities.FindAsync(id);
            if (activity == null)
            {
                return NotFound(new { error = "Activity not found" });
            }

            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            if (activity.TranslatorId != translatorId && userRole != "Project Manager" && userRole != "Admin")
            {
                return Forbid();
            }

            if (dto.RemainingHours < 0)
            {
                return BadRequest(new { error = "Remaining work estimate (hours) cannot be negative." });
            }

            decimal currentProgress = await _context.DailyWorkRecords
                .Where(d => d.ActivityId == id)
                .SumAsync(d => (decimal?)d.ProgressPercentage) ?? 0m;
            currentProgress = Math.Min(100.00m, Math.Round(currentProgress, 2));

            decimal remainingPct = dto.RemainingPercentage.HasValue
                ? Math.Clamp(Math.Round(dto.RemainingPercentage.Value, 2), 0m, 100m)
                : Math.Max(0m, 100.00m - currentProgress);

            DateOnly subDate = DateOnly.FromDateTime(DateTime.UtcNow);
            if (!string.IsNullOrWhiteSpace(dto.SubmissionDate) && DateOnly.TryParse(dto.SubmissionDate, out DateOnly parsedDate))
            {
                subDate = parsedDate;
            }

            string? fileType = dto.AttachmentFileType?.Trim().ToUpperInvariant();
            if (string.IsNullOrEmpty(fileType) && !string.IsNullOrWhiteSpace(dto.AttachmentFileName))
            {
                var ext = System.IO.Path.GetExtension(dto.AttachmentFileName)?.TrimStart('.').ToUpperInvariant();
                fileType = string.IsNullOrEmpty(ext) ? "DOCX" : ext;
            }

            var estimation = new WeeklyEstimation
            {
                ActivityId = id,
                ProjectId = activity.ProjectId,
                TranslatorId = activity.TranslatorId,
                RemainingHours = Math.Round(dto.RemainingHours, 2),
                RemainingPercentage = remainingPct,
                CompletedProgress = currentProgress,
                CompletedText = dto.CompletedText?.Trim(),
                AttachmentFileName = dto.AttachmentFileName?.Trim(),
                AttachmentFileType = fileType,
                AttachmentFileSize = dto.AttachmentFileSize,
                SubmittedForReview = dto.SubmitForReview,
                SubmissionDate = subDate,
                CreatedAt = DateTime.UtcNow
            };

            _context.WeeklyEstimations.Add(estimation);

            // Update Activity tracking fields and status to 'In Review' if submitted for Friday review
            activity.RemainingHoursEstimate = estimation.RemainingHours;
            if (!string.IsNullOrWhiteSpace(estimation.AttachmentFileName))
            {
                activity.LatestAttachmentName = estimation.AttachmentFileName;
                activity.LatestAttachmentType = estimation.AttachmentFileType ?? "DOCX";
            }

            if (dto.SubmitForReview)
            {
                activity.Status = "In Review";
                activity.LastSubmittedAt = DateTime.UtcNow;
            }
            else if (string.IsNullOrEmpty(activity.Status) || activity.Status == "Pending Start")
            {
                activity.Status = "In Progress";
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = dto.SubmitForReview
                    ? "Friday weekly estimation & translation submitted for review! Status updated to 'In Review'."
                    : "Weekly remaining work estimation saved to history.",
                status = activity.Status,
                remainingHoursEstimate = activity.RemainingHoursEstimate,
                lastSubmittedAt = activity.LastSubmittedAt,
                latestAttachmentName = activity.LatestAttachmentName,
                latestAttachmentType = activity.LatestAttachmentType,
                estimation = new
                {
                    id = estimation.Id,
                    activityId = estimation.ActivityId,
                    projectId = estimation.ProjectId,
                    remainingHours = estimation.RemainingHours,
                    remainingPercentage = estimation.RemainingPercentage,
                    completedProgress = estimation.CompletedProgress,
                    completedText = estimation.CompletedText,
                    attachmentFileName = estimation.AttachmentFileName,
                    attachmentFileType = estimation.AttachmentFileType,
                    attachmentFileSize = estimation.AttachmentFileSize,
                    submittedForReview = estimation.SubmittedForReview,
                    submissionDate = estimation.SubmissionDate.ToString("yyyy-MM-dd"),
                    createdAt = estimation.CreatedAt
                }
            });
        }

        [HttpGet("{id}/weekly-estimations")]
        public async Task<IActionResult> GetWeeklyEstimations(int id)
        {
            var activity = await _context.Activities.FindAsync(id);
            if (activity == null)
            {
                return NotFound(new { error = "Activity not found" });
            }

            var estimations = await _context.WeeklyEstimations
                .Where(w => w.ActivityId == id)
                .OrderByDescending(w => w.SubmissionDate)
                .ThenByDescending(w => w.Id)
                .Select(w => new
                {
                    id = w.Id,
                    activityId = w.ActivityId,
                    projectId = w.ProjectId,
                    remainingHours = w.RemainingHours,
                    remainingPercentage = w.RemainingPercentage,
                    completedProgress = w.CompletedProgress,
                    completedText = w.CompletedText,
                    attachmentFileName = w.AttachmentFileName,
                    attachmentFileType = w.AttachmentFileType,
                    attachmentFileSize = w.AttachmentFileSize,
                    submittedForReview = w.SubmittedForReview,
                    submissionDate = w.SubmissionDate.ToString("yyyy-MM-dd"),
                    createdAt = w.CreatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                activityId = id,
                activityName = activity.Name,
                status = activity.Status ?? "Pending Start",
                remainingHoursEstimate = activity.RemainingHoursEstimate,
                lastSubmittedAt = activity.LastSubmittedAt,
                latestAttachmentName = activity.LatestAttachmentName,
                latestAttachmentType = activity.LatestAttachmentType,
                totalCount = estimations.Count,
                estimations = estimations
            });
        }

        // =========================================================================
        // STORY #7: Defect Logging & Rejection (Editorial Review)
        // =========================================================================

        [HttpGet("{id}/defects")]
        public async Task<IActionResult> GetDefects(int id)
        {
            var activity = await _context.Activities.FindAsync(id);
            if (activity == null)
            {
                return NotFound(new { error = "Activity not found" });
            }

            var defectsRaw = await _context.TranslationDefects
                .Where(d => d.ActivityId == id)
                .OrderByDescending(d => d.CreatedAt)
                .ThenByDescending(d => d.Id)
                .ToListAsync();

            var editorIds = defectsRaw.Select(d => d.EditorId).Distinct().ToList();
            var editors = await _context.Employees
                .Where(e => editorIds.Contains(e.Id))
                .ToDictionaryAsync(e => e.Id, e => e.Initials);

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
                activityId = id,
                projectId = activity.ProjectId,
                status = activity.Status ?? "Pending Start",
                totalDefects = defects.Count,
                openDefects = defects.Count(d => !d.isResolved),
                defects = defects
            });
        }

        [HttpPost("{id}/defects")]
        public async Task<IActionResult> LogDefect(int id, [FromBody] CreateDefectDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int editorId))
            {
                return Unauthorized(new { error = "User identity not verified" });
            }

            var activity = await _context.Activities.FindAsync(id);
            if (activity == null)
            {
                return NotFound(new { error = "Activity not found" });
            }

            if (!await HasEditorAccessAsync(activity.ProjectId, editorId, userRole))
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(dto.RevisionComment))
            {
                return BadRequest(new { error = "Revision comment describing the translation mistake is required." });
            }

            var defect = new TranslationDefect
            {
                ActivityId = id,
                ProjectId = activity.ProjectId,
                EditorId = editorId,
                ErrorCategory = string.IsNullOrWhiteSpace(dto.ErrorCategory) ? "Terminology" : dto.ErrorCategory.Trim(),
                Severity = string.IsNullOrWhiteSpace(dto.Severity) ? "Major" : dto.Severity.Trim(),
                LocationReference = dto.LocationReference?.Trim(),
                RevisionComment = dto.RevisionComment.Trim(),
                IsResolved = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.TranslationDefects.Add(defect);

            if (dto.SendBackToTranslator)
            {
                activity.Status = "Revision Requested";
            }

            await _context.SaveChangesAsync();

            var editorInitials = User.FindFirst(ClaimTypes.Name)?.Value ?? "CE";

            return Ok(new
            {
                message = dto.SendBackToTranslator
                    ? "Defect logged and task sent back to Translator for correction ('Revision Requested')."
                    : "Defect logged successfully.",
                status = activity.Status,
                defect = new
                {
                    id = defect.Id,
                    activityId = defect.ActivityId,
                    projectId = defect.ProjectId,
                    editorId = defect.EditorId,
                    editorInitials = editorInitials,
                    errorCategory = defect.ErrorCategory,
                    severity = defect.Severity,
                    locationReference = defect.LocationReference,
                    revisionComment = defect.RevisionComment,
                    isResolved = defect.IsResolved,
                    createdAt = defect.CreatedAt
                }
            });
        }

        [HttpPut("{id}/review-status")]
        public async Task<IActionResult> UpdateReviewStatus(int id, [FromBody] UpdateReviewStatusDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int editorId))
            {
                return Unauthorized(new { error = "User identity not verified" });
            }

            var activity = await _context.Activities.FindAsync(id);
            if (activity == null)
            {
                return NotFound(new { error = "Activity not found" });
            }

            if (!await HasEditorAccessAsync(activity.ProjectId, editorId, userRole))
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(dto.Status))
            {
                return BadRequest(new { error = "Target status is required." });
            }

            activity.Status = dto.Status.Trim();

            // If sending back to translator with a comment, also log a defect record
            if (!string.IsNullOrWhiteSpace(dto.RevisionComment))
            {
                var defect = new TranslationDefect
                {
                    ActivityId = id,
                    ProjectId = activity.ProjectId,
                    EditorId = editorId,
                    ErrorCategory = string.IsNullOrWhiteSpace(dto.ErrorCategory) ? "General Revision" : dto.ErrorCategory.Trim(),
                    Severity = string.IsNullOrWhiteSpace(dto.Severity) ? "Major" : dto.Severity.Trim(),
                    LocationReference = dto.LocationReference?.Trim(),
                    RevisionComment = dto.RevisionComment.Trim(),
                    IsResolved = false,
                    CreatedAt = DateTime.UtcNow
                };
                _context.TranslationDefects.Add(defect);
            }

            // If approved or completed, mark open defects as resolved
            if (activity.Status == "Approved" || activity.Status == "Completed")
            {
                var openDefects = await _context.TranslationDefects
                    .Where(d => d.ActivityId == id && !d.IsResolved)
                    .ToListAsync();
                foreach (var d in openDefects)
                {
                    d.IsResolved = true;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Activity status updated to '{activity.Status}'.",
                activityId = id,
                projectId = activity.ProjectId,
                status = activity.Status
            });
        }

        [HttpPatch("{id}/defects/{defectId}/resolve")]
        public async Task<IActionResult> ToggleResolveDefect(int id, int defectId)
        {
            var defect = await _context.TranslationDefects.FirstOrDefaultAsync(d => d.Id == defectId && d.ActivityId == id);
            if (defect == null)
            {
                return NotFound(new { error = "Defect record not found" });
            }

            defect.IsResolved = !defect.IsResolved;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = defect.IsResolved ? "Defect marked as resolved." : "Defect reopened.",
                id = defect.Id,
                isResolved = defect.IsResolved
            });
        }

        [HttpDelete("{id}/defects/{defectId}")]
        public async Task<IActionResult> DeleteDefect(int id, int defectId)
        {
            var defect = await _context.TranslationDefects.FirstOrDefaultAsync(d => d.Id == defectId && d.ActivityId == id);
            if (defect == null)
            {
                return NotFound(new { error = "Defect record not found" });
            }

            _context.TranslationDefects.Remove(defect);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Defect entry deleted." });
        }
    }
}
