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
        public string Name { get; set; } = string.Empty;

        [Required]
        [Column("project_manager_id")]
        public int ProjectManagerId { get; set; }

        [Column("chief_editor_id")]
        public int? ChiefEditorId { get; set; }

        [Column("secondary_chief_editor_id")]
        public int? SecondaryChiefEditorId { get; set; }

        [Column("reassignment_note")]
        public string? ReassignmentNote { get; set; }

        [Column("reassigned_at")]
        public DateTime? ReassignedAt { get; set; }

        [Column("complexity_level")]
        [StringLength(20)]
        public string? ComplexityLevel { get; set; }

        [Column("review_hours")]
        public decimal? ReviewHours { get; set; }

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; }

        [Column("due_date")]
        public DateTime? DueDate { get; set; }
    }
}
