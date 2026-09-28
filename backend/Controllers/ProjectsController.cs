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
        public string Name { get; set; }
        public int PrimaryTranslatorId { get; set; }
        public string ComplexityLevel { get; set; }
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

            var project = new Project
            {
                ProjectNumber = dto.ProjectNumber,
                Name = dto.Name,
                ProjectManagerId = projectManagerId,
                ComplexityLevel = dto.ComplexityLevel
            };

            _context.Projects.Add(project);
            await _context.SaveChangesAsync();

            var activity = new Activity
            {
                ProjectId = project.Id,
                TranslatorId = dto.PrimaryTranslatorId,
                ActivityNumber = 1,
                Name = dto.Name + " - Main Activity",
                PlannedHours = 0
            };
            
            _context.Activities.Add(activity);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Project created successfully", projectId = project.Id });
        }

        [HttpGet]
        public async Task<IActionResult> GetProjects()
        {
            var projects = await (from p in _context.Projects
                                  join a in _context.Activities on p.Id equals a.ProjectId into pa
                                  from a in pa.DefaultIfEmpty()
                                  join t in _context.Employees on a.TranslatorId equals t.Id into at
                                  from t in at.DefaultIfEmpty()
                                  select new
                                  {
                                      projectId = p.Id,
                                      id = p.ProjectNumber,
                                      name = p.Name,
                                      translator = t.Initials ?? "Unassigned",
                                      complexity = p.ComplexityLevel,
                                      reviewHours = p.ReviewHours
                                  }).ToListAsync();

            return Ok(projects);
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
        public async Task<IActionResult> GetMyActivities()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int translatorId))
            {
                return Unauthorized();
            }

            var activities = await (from a in _context.Activities
                                    where a.TranslatorId == translatorId
                                    join p in _context.Projects on a.ProjectId equals p.Id
                                    select new
                                    {
                                        activityNumber = a.ActivityNumber,
                                        projectName = p.Name,
                                        projectNumber = p.ProjectNumber,
                                        plannedHours = a.PlannedHours
                                    }).ToListAsync();

            return Ok(activities);
        }
    }
}
