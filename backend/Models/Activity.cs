// Models/Activity.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EasyLang.Models
{
    [Table("Activity")]
    public class Activity
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("project_id")]
        public int ProjectId { get; set; }

        [Required]
        [Column("translator_id")]
        public int TranslatorId { get; set; }

        [Column("activity_number")]
        public int ActivityNumber { get; set; }

        [Column("name")]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [Column("planned_hours")]
        public decimal PlannedHours { get; set; }

        [Column("status")]
        [StringLength(50)]
        public string? Status { get; set; } = "Pending Start";

        [Column("remaining_hours_estimate")]
        public decimal? RemainingHoursEstimate { get; set; }

        [Column("last_submitted_at")]
        public DateTime? LastSubmittedAt { get; set; }

        [Column("latest_attachment_name")]
        [StringLength(255)]
        public string? LatestAttachmentName { get; set; }

        [Column("latest_attachment_type")]
        [StringLength(20)]
        public string? LatestAttachmentType { get; set; }
    }
}
