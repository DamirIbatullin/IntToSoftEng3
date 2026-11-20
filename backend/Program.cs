// Program.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using EasyLang.Data;
using EasyLang.Services;

var builder = WebApplication.CreateBuilder(args);

// Add Database Context
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Add Automations and Background Services for Sprint 4
builder.Services.AddScoped<AutomationsService>();
builder.Services.AddHostedService<BackgroundAutomationWorker>();

// Add Controllers (No Minimal APIs)
builder.Services.AddControllers();

// Configure JWT Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "Default_Secret_Key_At_Least_32_Characters_Long!"))
        };
    });

// Enable CORS so React (running on localhost:5173) can communicate with this API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy => policy.WithOrigins("http://localhost:5173")
                        .AllowAnyHeader()
                        .AllowAnyMethod());
});

var app = builder.Build();

app.UseCors("AllowReactApp");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Ensure DB columns and tables exist for Sprint 2 and Sprint 3 (isolated statements so none can roll back others)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    string[] migrationStatements = new[]
    {
        @"ALTER TABLE ""Project"" ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;",
        @"ALTER TABLE ""Project"" ADD COLUMN IF NOT EXISTS due_date DATE;",
        @"ALTER TABLE ""Project"" ADD COLUMN IF NOT EXISTS secondary_chief_editor_id INTEGER;",
        @"ALTER TABLE ""Project"" ADD COLUMN IF NOT EXISTS reassignment_note TEXT;",
        @"ALTER TABLE ""Project"" ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP WITH TIME ZONE;",

        @"ALTER TABLE ""Activity"" ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending Start';",
        @"ALTER TABLE ""Activity"" ADD COLUMN IF NOT EXISTS remaining_hours_estimate NUMERIC(6, 2);",
        @"ALTER TABLE ""Activity"" ADD COLUMN IF NOT EXISTS last_submitted_at TIMESTAMP WITH TIME ZONE;",
        @"ALTER TABLE ""Activity"" ADD COLUMN IF NOT EXISTS latest_attachment_name VARCHAR(255);",
        @"ALTER TABLE ""Activity"" ADD COLUMN IF NOT EXISTS latest_attachment_type VARCHAR(20);",

        @"CREATE TABLE IF NOT EXISTS ""WeeklyEstimation"" (
            id SERIAL PRIMARY KEY,
            activity_id INTEGER NOT NULL REFERENCES ""Activity""(id) ON DELETE CASCADE,
            project_id INTEGER NOT NULL REFERENCES ""Project""(id) ON DELETE CASCADE,
            translator_id INTEGER NOT NULL REFERENCES ""Employee""(id) ON DELETE CASCADE,
            remaining_hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
            remaining_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
            completed_progress NUMERIC(5, 2) NOT NULL DEFAULT 0,
            completed_text TEXT,
            attachment_file_name VARCHAR(255),
            attachment_file_type VARCHAR(20),
            attachment_file_size INTEGER,
            submitted_for_review BOOLEAN DEFAULT TRUE,
            submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );",
        @"CREATE INDEX IF NOT EXISTS idx_weekly_estimation_activity ON ""WeeklyEstimation""(activity_id);",
        @"CREATE INDEX IF NOT EXISTS idx_weekly_estimation_project ON ""WeeklyEstimation""(project_id);",

        @"CREATE TABLE IF NOT EXISTS ""TranslationDefect"" (
            id SERIAL PRIMARY KEY,
            activity_id INTEGER NOT NULL REFERENCES ""Activity""(id) ON DELETE CASCADE,
            project_id INTEGER NOT NULL REFERENCES ""Project""(id) ON DELETE CASCADE,
            editor_id INTEGER NOT NULL REFERENCES ""Employee""(id) ON DELETE CASCADE,
            error_category VARCHAR(50) NOT NULL DEFAULT 'Terminology',
            severity VARCHAR(20) NOT NULL DEFAULT 'Major',
            location_reference VARCHAR(100),
            revision_comment TEXT NOT NULL,
            is_resolved BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );",
        @"CREATE INDEX IF NOT EXISTS idx_translation_defect_activity ON ""TranslationDefect""(activity_id);",
        @"CREATE INDEX IF NOT EXISTS idx_translation_defect_project ON ""TranslationDefect""(project_id);",

        @"CREATE TABLE IF NOT EXISTS ""ProjectEditorAccess"" (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES ""Project""(id) ON DELETE CASCADE,
            editor_id INTEGER NOT NULL REFERENCES ""Employee""(id) ON DELETE CASCADE,
            access_level VARCHAR(30) NOT NULL DEFAULT 'Secondary',
            can_review BOOLEAN DEFAULT TRUE,
            can_log_defects BOOLEAN DEFAULT TRUE,
            can_toggle_status BOOLEAN DEFAULT TRUE,
            granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id, editor_id)
        );",

        @"INSERT INTO ""Employee"" (id, initials, password, role) VALUES (901, 'KS', 'Kausar2026', 'Chief Editor') ON CONFLICT DO NOTHING;",
        @"INSERT INTO ""Employee"" (id, initials, password, role) VALUES (902, 'AS', 'Assel2026', 'Chief Editor') ON CONFLICT DO NOTHING;",
        @"INSERT INTO ""Employee"" (id, initials, password, role) VALUES (903, 'AU', 'Alsu2026', 'Chief Editor') ON CONFLICT DO NOTHING;",
        @"INSERT INTO ""Employee"" (id, initials, password, role) VALUES (904, 'ER', 'Elena2026', 'Chief Editor') ON CONFLICT DO NOTHING;",

        // Sprint 4 (Iteration 4) Schema Automations & Data Sync
        @"ALTER TABLE ""Activity"" ADD COLUMN IF NOT EXISTS correction_setback_percentage NUMERIC(5, 2) DEFAULT 0;",
        @"ALTER TABLE ""Activity"" ADD COLUMN IF NOT EXISTS effective_progress NUMERIC(5, 2) DEFAULT 0;",

        @"ALTER TABLE ""Project"" ADD COLUMN IF NOT EXISTS health_status VARCHAR(30) DEFAULT 'On Track';",
        @"ALTER TABLE ""Project"" ADD COLUMN IF NOT EXISTS calculated_velocity NUMERIC(5, 2) DEFAULT 0;",
        @"ALTER TABLE ""Project"" ADD COLUMN IF NOT EXISTS required_velocity NUMERIC(5, 2) DEFAULT 0;",
        @"ALTER TABLE ""Project"" ADD COLUMN IF NOT EXISTS projected_delay_days INTEGER DEFAULT 0;",
        @"ALTER TABLE ""Project"" ADD COLUMN IF NOT EXISTS last_status_sync_at TIMESTAMP WITH TIME ZONE;",

        @"CREATE TABLE IF NOT EXISTS ""AlertNotification"" (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES ""Employee""(id) ON DELETE CASCADE,
            project_id INTEGER REFERENCES ""Project""(id) ON DELETE CASCADE,
            activity_id INTEGER REFERENCES ""Activity""(id) ON DELETE CASCADE,
            alert_type VARCHAR(50) NOT NULL,
            severity VARCHAR(20) NOT NULL DEFAULT 'Warning',
            title VARCHAR(150) NOT NULL,
            message TEXT NOT NULL,
            is_dismissed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );",
        @"CREATE INDEX IF NOT EXISTS idx_alert_notification_user ON ""AlertNotification""(user_id);",
        @"CREATE INDEX IF NOT EXISTS idx_alert_notification_activity ON ""AlertNotification""(activity_id);",

        // Sprint 4 Data Alignment: Ensure projects have due_date set to 2026-10-13
        @"UPDATE ""Project"" SET due_date = '2026-10-13' WHERE due_date IS NULL OR id <= 10;",
        // Clean up any misplaced translator alerts that were sent to Project Managers or non-translators
        @"DELETE FROM ""AlertNotification"" WHERE user_id IN (SELECT id FROM ""Employee"" WHERE role != 'Translator') AND alert_type IN ('MissingDailyLog', 'MissingWeeklyEstimation');",
        @"DELETE FROM ""AlertNotification"" WHERE user_id = 1 AND message LIKE '%You haven''t logged%';",

        // Story #10 Translator Project Scoping: Delete alerts for projects that the translator is NOT assigned to / has no access to
        @"DELETE FROM ""AlertNotification"" an
          WHERE an.project_id IS NOT NULL 
            AND an.user_id IN (SELECT id FROM ""Employee"" WHERE role = 'Translator')
            AND NOT EXISTS (
                SELECT 1 FROM ""Activity"" a 
                WHERE a.project_id = an.project_id 
                  AND a.translator_id = an.user_id
            );",

        // Delete alerts for activities that the translator is NOT assigned to
        @"DELETE FROM ""AlertNotification"" an
          WHERE an.activity_id IS NOT NULL 
            AND an.user_id IN (SELECT id FROM ""Employee"" WHERE role = 'Translator')
            AND NOT EXISTS (
                SELECT 1 FROM ""Activity"" a 
                WHERE a.id = an.activity_id 
                  AND a.translator_id = an.user_id
            );",

        // Sprint 4 Alignment: Ensure activities and projects have proper planned and review hours
        @"UPDATE ""Activity"" a
          SET planned_hours = CASE 
              WHEN p.complexity_level = 'Low' THEN 14.0
              WHEN p.complexity_level = 'High' THEN 42.0
              ELSE 28.0
          END,
          remaining_hours_estimate = CASE 
              WHEN p.complexity_level = 'Low' THEN 14.0
              WHEN p.complexity_level = 'High' THEN 42.0
              ELSE 28.0
          END
          FROM ""Project"" p
          WHERE a.project_id = p.id AND (a.planned_hours = 0 OR a.planned_hours IS NULL OR p.name IN ('Ex 1', 'Ex 2'));",

        @"UPDATE ""Project""
          SET review_hours = CASE 
              WHEN complexity_level = 'Low' THEN 4.0
              WHEN complexity_level = 'High' THEN 12.0
              ELSE 7.0
          END
          WHERE review_hours IS NULL OR name IN ('Ex 1', 'Ex 2');"
    };

    foreach (var sql in migrationStatements)
    {
        try
        {
            db.Database.ExecuteSqlRaw(sql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"DB Migration step notice: {ex.Message}");
        }
    }
}

app.Run();
