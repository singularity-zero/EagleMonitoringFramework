using System;
using System.IO;
using System.Threading;
using ProductMonitor.DisplayCode;
using ProductMonitor.Framework;
using ProductMonitor.Framework.Generic;
using ProductMonitor.Framework.ProgramCode;
using Serilog;

namespace ProductMonitor
{
    static class Program
    {
        private static readonly string _configFilePathRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"Config");
        private static Check[] _listOfChecks;
        private static string _tempPath;

        public static void Main()
        {
            Log.Logger = new LoggerConfiguration()
                .WriteTo.ColoredConsole()
                .CreateLogger();

            Log.Information("Application Start");

            try
            {
                _tempPath = AppDomain.CurrentDomain.BaseDirectory + "TEMP";
                var cleanup = new Cleanup(_tempPath);
                var messageService = new MessageService();
                var screenshotService = new ScreenshotService();
                var emailController = new EmailController(_tempPath, screenshotService, messageService, cleanup);
                var soundController = new SoundController(messageService);
                var globalAlarm = new GlobalAlarm(emailController);

                var guiController = new GuiController();

                guiController.StartUp(() => _listOfChecks ?? new Check[0]);

                _listOfChecks = new XmlFile(_configFilePathRoot, messageService, emailController, globalAlarm, soundController, 
                    (s, i) => new Check(s, i, c => guiController.Update(c), globalAlarm)).Load();

                globalAlarm.PrepareList(_listOfChecks);

                foreach (Check c in _listOfChecks)
                {
                    c.Activate();
                }

                //pause the main thread. The application runs in many other threads.
                Thread.Sleep(Timeout.Infinite);

            }
            catch (Exception e)
            {
                Log.Error(e, "Failed to start application");
            }
        }

        //-----------------------------------
        // Loading from XML Code
        //-----------------------------------

        #region Loading

        
        #endregion

        public static void PauseCheck(int index)
        {
            if (!_listOfChecks[index].IsPaused())
            {
                _listOfChecks[index].Pause(true);
                _listOfChecks[index].Activate();
            }
        }

        public static void UnpauseCheck(int index)
        {
            if (_listOfChecks[index].IsPaused())
            {
                _listOfChecks[index].Pause(false);
                _listOfChecks[index].Activate();
            }
        }

        public static void Exit()
        {
            //clean up (will not get everything)
            try
            {
                Directory.Delete(_tempPath, true);
            }
            catch (Exception e)
            {
                Log.Error(e, "Failed to delete directory on exit");
            }

            Log.Information("Application Exit");

            Environment.Exit(0);
        }

        public static Check[] ListOfChecks
        {
            get
            {
                return _listOfChecks;
            }
        }
    }
}
