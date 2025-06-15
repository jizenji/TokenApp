'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Bell, Palette, ShieldQuestion } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    // Check for saved theme preference or system preference
    const isDarkMode = localStorage.getItem('theme') === 'dark' || 
                      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = (checked: boolean) => {
    setDarkMode(checked);
    if (checked) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-0 space-y-8">
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-2 mb-2">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold tracking-tight">Application Settings</CardTitle>
          </div>
          <CardDescription className="text-lg text-muted-foreground">
            Customize your application experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4 p-6 border rounded-lg">
            <h3 className="text-xl font-semibold flex items-center"><Palette className="mr-2 h-5 w-5 text-muted-foreground" />Appearance</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="dark-mode" className="text-base">
                Dark Mode
              </Label>
              <Switch
                id="dark-mode"
                checked={darkMode}
                onCheckedChange={toggleDarkMode}
                aria-label="Toggle dark mode"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Switch between light and dark themes for optimal viewing comfort.
            </p>
          </div>

          <div className="space-y-4 p-6 border rounded-lg">
            <h3 className="text-xl font-semibold flex items-center"><Bell className="mr-2 h-5 w-5 text-muted-foreground" />Notifications</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="notifications" className="text-base">
                Enable Notifications
              </Label>
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
                aria-label="Toggle notifications"
              />
            </div>
             <p className="text-sm text-muted-foreground">
              Receive alerts for important events and updates. (Demo setting)
            </p>
          </div>

          <div className="space-y-4 p-6 border rounded-lg">
             <h3 className="text-xl font-semibold">Language</h3>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language-select">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="id">Bahasa Indonesia</SelectItem>
                <SelectItem value="es">Español (Demo)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Choose your preferred language for the application interface. (Demo setting)
            </p>
          </div>
          
          <div className="space-y-4 p-6 border rounded-lg">
            <h3 className="text-xl font-semibold flex items-center"><ShieldQuestion className="mr-2 h-5 w-5 text-muted-foreground" />Account Security</h3>
            <Button variant="outline">Change Password</Button>
             <p className="text-sm text-muted-foreground">
              It&apos;s a good practice to regularly update your password. (Placeholder button)
            </p>
          </div>

          <div className="flex justify-end mt-8">
            <Button>Save Settings</Button>
          </div>
           <p className="text-xs text-center text-muted-foreground mt-2">Some settings are for demonstration and may not persist.</p>
        </CardContent>
      </Card>
    </div>
  );
}
