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
        public decimal? ReviewHours { get; set; }
    }

    public class UpdateReviewDto
    {
        public decimal ReviewHours { get; set; }
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
            int projectManagerId = 0;
            if (userIdClaim != null)
            {
                int.TryParse(userIdClaim, out projectManagerId);
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
                PlannedHours = 0
            };
            
            _context.Activities.Add(activity);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Project created successfully", projectId = project.Id });
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
                .Select(g => g.OrderBy(a => a.ActivityNumber).FirstOrDefault())
                .Where(a => a != null)
                .ToDictionary(a => a!.ProjectId, a => a!);

            var activityIds = activities.Select(a => a.Id).ToList();

            var dailyLogsSummary = await _context.DailyWorkRecords
                .Where(d => activityIds.Contains(d.ActivityId))
                .GroupBy(d => d.ActivityId)
                .Select(g => new
                {
                    ActivityId = g.Key,
                    CumulativeProgress = g.Sum(x => x.ProgressPercentage),
                    LogsCount = g.Count()
                })
                .ToDictionaryAsync(x => x.ActivityId);

            var translatorIds = primaryActivities.Values
                .Select(a => a.TranslatorId)
                .Distinct()
                .ToList();

            var translators = await _context.Employees
                .Where(e => translatorIds.Contains(e.Id))
                .ToDictionaryAsync(e => e.Id, e => e.Initials);

            var result = rawProjects.Select(p =>
            {
                primaryActivities.TryGetValue(p.Id, out var act);
                string translatorName = "Unassigned";
                decimal cumulativeProgress = 0.00m;
                int logsCount = 0;

                if (act != null)
                {
                    if (translators.TryGetValue(act.TranslatorId, out var initials))
                    {
                        translatorName = initials;
                    }

                    if (dailyLogsSummary.TryGetValue(act.Id, out var sum))
                    {
                        cumulativeProgress = Math.Min(100.00m, Math.Round(sum.CumulativeProgress, 2));
                        logsCount = sum.LogsCount;
                    }
                }

                // If no daily log has been entered yet: status is Pending Start and progress is 0%
                string status = logsCount == 0 
                    ? "Pending Start" 
                    : (cumulativeProgress >= 100.00m ? "Completed" : "On Track");

                return new
                {
                    projectId = p.Id,
                    id = p.ProjectNumber,
                    name = p.Name,
                    translator = translatorName,
                    complexity = p.ComplexityLevel,
                    reviewHours = p.ReviewHours,
                    progress = cumulativeProgress,
                    logsCount = logsCount,
                    status = status,
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

            project.ReviewHours = dto.ReviewHours;

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out int ceId)) {
                project.ChiefEditorId = ceId;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Review metrics updated successfully" });
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
                                        complexity = p.ComplexityLevel
                                    }).ToListAsync();

            var activityIds = rawActivities.Select(a => a.activityId).ToList();

            var dailyLogsSummary = await _context.DailyWorkRecords
                .Where(d => activityIds.Contains(d.ActivityId))
                .GroupBy(d => d.ActivityId)
                .Select(g => new
                {
                    ActivityId = g.Key,
                    CumulativeProgress = g.Sum(x => x.ProgressPercentage),
                    LatestLogDate = g.Max(x => x.LogDate),
                    LogsCount = g.Count()
                })
                .ToDictionaryAsync(x => x.ActivityId);

            var enrichedActivities = rawActivities.Select(a =>
            {
                dailyLogsSummary.TryGetValue(a.activityId, out var summary);
                decimal progress = summary != null ? Math.Min(100.00m, Math.Round(summary.CumulativeProgress, 2)) : 0.00m;
                string? latestDate = summary?.LatestLogDate.ToString("yyyy-MM-dd");
                int logsCount = summary?.LogsCount ?? 0;

                return new
                {
                    activityId = a.activityId,
                    activityNumber = a.activityNumber,
                    activityName = a.activityName,
                    projectId = a.projectId,
                    projectName = a.projectName,
                    projectNumber = a.projectNumber,
                    plannedHours = a.plannedHours,
                    complexity = a.complexity,
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
