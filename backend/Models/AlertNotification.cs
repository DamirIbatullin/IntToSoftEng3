// Models/AlertNotification.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EasyLang.Models
{
    [Table("AlertNotification")]
    public class AlertNotification
    {
        [Key]
        [Column("id")]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [Column("user_id")]
        public int UserId { get; set; }

        [Column("project_id")]
        public int? ProjectId { get; set; }

        [Column("activity_id")]
        public int? ActivityId { get; set; }

        [Required]
        [Column("alert_type")]
        [StringLength(50)]
        public string AlertType { get; set; } = "MissingDailyLog"; // MissingDailyLog, MissingWeeklyEstimation, RevisionCorrection, SLARisk

        [Required]
        [Column("severity")]
        [StringLength(20)]
        public string Severity { get; set; } = "Warning"; // Info, Warning, Urgent

        [Required]
        [Column("title")]
        [StringLength(150)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [Column("message")]
        public string Message { get; set; } = string.Empty;

        [Column("is_dismissed")]
        public bool IsDismissed { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
