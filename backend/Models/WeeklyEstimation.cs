using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EasyLang.Models
{
    [Table("WeeklyEstimation")]
    public class WeeklyEstimation
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
        [Column("translator_id")]
        public int TranslatorId { get; set; }

        [Required]
        [Column("remaining_hours")]
        public decimal RemainingHours { get; set; }

        [Required]
        [Column("remaining_percentage")]
        public decimal RemainingPercentage { get; set; }

        [Required]
        [Column("completed_progress")]
        public decimal CompletedProgress { get; set; }

        [Column("completed_text")]
        public string? CompletedText { get; set; }

        [Column("attachment_file_name")]
        [StringLength(255)]
        public string? AttachmentFileName { get; set; }

        [Column("attachment_file_type")]
        [StringLength(20)]
        public string? AttachmentFileType { get; set; }

        [Column("attachment_file_size")]
        public int? AttachmentFileSize { get; set; }

        [Column("submitted_for_review")]
        public bool SubmittedForReview { get; set; } = true;

        [Column("submission_date")]
        public DateOnly SubmissionDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
