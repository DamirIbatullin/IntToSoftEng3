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
        public string Name { get; set; }

        [Column("planned_hours")]
        public decimal PlannedHours { get; set; }
    }
}
