using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EasyLang.Models
{
    [Table("DailyWorkRecord")]
    public class DailyWorkRecord
    {
        [Key]
        [Column("id")]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [Column("activity_id")]
        public int ActivityId { get; set; }

        [Required]
        [Column("translator_id")]
        public int TranslatorId { get; set; }

        [Required]
        [Column("log_date")]
        public DateOnly LogDate { get; set; }

        [Required]
        [Column("progress_percentage")]
        public decimal ProgressPercentage { get; set; }

        [Column("pages_translated")]
        public decimal? PagesTranslated { get; set; }

        [Column("hours_spent")]
        public decimal? HoursSpent { get; set; }

        [Column("notes")]
        public string? Notes { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
