using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EasyLang.Models
{
    [Table("TranslationDefect")]
    public class TranslationDefect
    {
        [Key]
        [Column("id")]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [Column("activity_id")]
        public int ActivityId { get; set; }

        [Required]
        [Column("project_id")]
        public int ProjectId { get; set; }

        [Required]
        [Column("editor_id")]
        public int EditorId { get; set; }

        [Required]
        [Column("error_category")]
        [StringLength(50)]
        public string ErrorCategory { get; set; } = "Terminology";

        [Required]
        [Column("severity")]
        [StringLength(20)]
        public string Severity { get; set; } = "Major";

        [Column("location_reference")]
        [StringLength(100)]
        public string? LocationReference { get; set; }

        [Required]
        [Column("revision_comment")]
        public string RevisionComment { get; set; } = string.Empty;

        [Column("is_resolved")]
        public bool IsResolved { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
