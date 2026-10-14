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
            await _context.SaveChangesAsync();

            decimal newCumulative = currentTotal + roundedPercentage;

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
                remainingPercentage = 100.00m - newCumulative
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

            decimal cumulative = logs.Sum(l => l.progressPercentage);

            return Ok(new
            {
                activityId = id,
                activityName = activity.Name,
                cumulativeProgress = Math.Min(100.00m, cumulative),
                remainingPercentage = Math.Max(0.00m, 100.00m - cumulative),
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

                var newTotal = await _context.DailyWorkRecords
                    .Where(d => d.ActivityId == id)
                    .SumAsync(d => (decimal?)d.ProgressPercentage) ?? 0m;

                return Ok(new
                {
                    message = "Daily log removed successfully.",
                    cumulativeProgress = newTotal
                });
            }

            return Forbid();
        }
    }
}
