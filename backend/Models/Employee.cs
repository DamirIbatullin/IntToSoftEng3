// Models/Employee.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EasyLang.Models
{
    [Table("Employee")] // Maps to PostgreSQL lowercase table name conventions
    public class Employee
    {
        [Key]
        [Column("id")]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public int Id { get; set; }

        [Required]
        [Column("initials")]
        public string Initials { get; set; }

        [Required]
        [Column("password")]
        public string Password { get; set; }

        [Required]
        [Column("role")]
        public string Role { get; set; }
    }
}