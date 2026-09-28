// Data/AppDbContext.cs
using Microsoft.EntityFrameworkCore;
using EasyLang.Models;

namespace EasyLang.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Employee> Employees { get; set; }
        public DbSet<Project> Projects { get; set; }
        public DbSet<Activity> Activities { get; set; }
    }
}