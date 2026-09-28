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
    }
}
