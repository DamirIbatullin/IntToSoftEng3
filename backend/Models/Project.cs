// Models/Project.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EasyLang.Models
{
    [Table("Project")]
    public class Project
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("project_number")]
        public long ProjectNumber { get; set; }

        [Required]
        [Column("name")]
        [StringLength(100)]
        public string Name { get; set; }

        [Required]
        [Column("project_manager_id")]
        public int ProjectManagerId { get; set; }

        [Column("chief_editor_id")]
        public int? ChiefEditorId { get; set; }

        [Column("complexity_level")]
        [StringLength(20)]
        public string? ComplexityLevel { get; set; }

        [Column("review_hours")]
        public decimal? ReviewHours { get; set; }
    }
}
