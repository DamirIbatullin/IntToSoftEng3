// Controllers/EmployeesController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EasyLang.Data;

namespace EasyLang.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EmployeesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public EmployeesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("translators")]
        public async Task<IActionResult> GetTranslators()
        {
            var translators = await _context.Employees
                .Where(e => e.Role == "Translator")
                .Select(e => new { e.Id, e.Initials })
                .ToListAsync();

            return Ok(translators);
        }

        [HttpGet("chief-editors")]
        public async Task<IActionResult> GetChiefEditors()
        {
            var editors = await _context.Employees
                .Where(e => e.Role == "Chief Editor")
                .OrderBy(e => e.Id)
                .Select(e => new { e.Id, e.Initials, e.Role })
                .ToListAsync();

            var projects = await _context.Projects.ToListAsync();

            var displayNames = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "DD", "Dulat (Lead CE)" },
                { "KS", "Kausar (Senior CE)" },
                { "AS", "Assel (Associate CE)" },
                { "AU", "Alsu (QA CE)" },
                { "ER", "Elena (Relief CE)" }
            };

            var enriched = editors.Select(e =>
            {
                var primaryProjects = projects.Where(p => p.ChiefEditorId == e.Id).ToList();
                var secondaryProjects = projects.Where(p => p.SecondaryChiefEditorId == e.Id).ToList();
                int primaryCount = primaryProjects.Count;
                int secondaryCount = secondaryProjects.Count;
                int totalCount = primaryCount + secondaryCount;
                decimal totalReviewHours = primaryProjects.Sum(p => p.ReviewHours ?? 0m) + secondaryProjects.Sum(p => (p.ReviewHours ?? 0m) * 0.5m);

                string availability = totalCount == 0
                    ? "Free"
                    : (totalCount <= 3 ? "Available" : (totalCount <= 8 ? "Moderate Load" : "Overloaded"));

                return new
                {
                    id = e.Id,
                    initials = e.Initials,
                    displayName = displayNames.TryGetValue(e.Initials, out var name) ? name : $"{e.Initials} (Chief Editor)",
                    role = e.Role,
                    primaryProjectsCount = primaryCount,
                    secondaryProjectsCount = secondaryCount,
                    totalAssignedProjects = totalCount,
                    totalReviewHours = Math.Round(totalReviewHours, 1),
                    availabilityStatus = availability,
                    isFree = totalCount <= 3
                };
            }).ToList();

            return Ok(enriched);
        }
    }
}
