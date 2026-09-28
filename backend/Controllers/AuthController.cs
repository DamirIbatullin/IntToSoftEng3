// Controllers/AuthController.cs
using BCrypt.Net;
using EasyLang.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace EasyLang.Controllers
{
    public class LoginRequest
    {
        public string Initials { get; set; }
        public string Password { get; set; }
    }

    public class RegisterRequest
    {
        public string Initials { get; set; }
        public string Password { get; set; }
        public string Role { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = await _context.Employees
                .FirstOrDefaultAsync(e => e.Initials == request.Initials);

            if (user == null || user.Password != request.Password)
            {
                return Unauthorized(new { error = "Invalid initials or password" });
            }

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Name, user.Initials),
                    new Claim(ClaimTypes.Role, user.Role)
                }),
                Expires = DateTime.UtcNow.AddHours(8),
                Issuer = _configuration["Jwt:Issuer"],
                Audience = _configuration["Jwt:Audience"],
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);

            return Ok(new
            {
                token = tokenHandler.WriteToken(token),
                role = user.Role
            });
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (await _context.Employees.AnyAsync(e => e.Initials == request.Initials))
            {
                return BadRequest(new { error = "User with these initials already exists" });
            }

            int nextId = 1;
            if (await _context.Employees.AnyAsync())
            {
                nextId = await _context.Employees.MaxAsync(e => e.Id) + 1;
            }

            var newUser = new EasyLang.Models.Employee
            {
                Id = nextId,
                Initials = request.Initials,
                Password = request.Password,
                Role = string.IsNullOrEmpty(request.Role) ? "Employee" : request.Role
            };

            _context.Employees.Add(newUser);
            await _context.SaveChangesAsync();

            return Ok(new { message = "User registered successfully" });
        }
    }
}