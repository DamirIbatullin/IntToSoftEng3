// Services/BackgroundAutomationWorker.cs
using EasyLang.Services;

namespace EasyLang.Services
{
    public class BackgroundAutomationWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<BackgroundAutomationWorker> _logger;

        public BackgroundAutomationWorker(IServiceProvider serviceProvider, ILogger<BackgroundAutomationWorker> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Sprint 4 Background Automation Worker starting...");

            // Initial delay to allow DB migrations and server startup to complete
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var automations = scope.ServiceProvider.GetRequiredService<AutomationsService>();

                        _logger.LogInformation("Background Automation Worker: Running missing logs check (Story #10)...");
                        int alertsCreated = await automations.RunMissingLogsCheckAsync();

                        _logger.LogInformation("Background Automation Worker: Synchronizing project health statuses and velocity (Story #11)...");
                        int projectsSynced = await automations.SynchronizeAllProjectStatusesAsync();

                        _logger.LogInformation("Background Automation Worker cycle complete. Alerts: {Alerts}, Projects Synced: {Projects}",
                            alertsCreated, projectsSynced);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred during background automation cycle: {Message}", ex.Message);
                }

                // Run every 15 minutes in background
                try
                {
                    await Task.Delay(TimeSpan.FromMinutes(15), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }

            _logger.LogInformation("Sprint 4 Background Automation Worker is stopping.");
        }
    }
}
