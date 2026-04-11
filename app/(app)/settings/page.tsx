import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-[#A1A1A1] mt-1">
          Platform configuration and environment settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
          <CardDescription>Current runtime configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-[#262626]/50 h-10">
                <td className="py-2 text-[#A1A1A1] w-48">ADS_API_MODE</td>
                <td className="py-2">
                  <Badge variant="warning">sandbox</Badge>
                </td>
              </tr>
              <tr className="border-b border-[#262626]/50 h-10">
                <td className="py-2 text-[#A1A1A1]">Platform Version</td>
                <td className="py-2 font-mono">v0.1.0</td>
              </tr>
              <tr className="border-b border-[#262626]/50 h-10">
                <td className="py-2 text-[#A1A1A1]">Meta API Version</td>
                <td className="py-2 font-mono">v20.0</td>
              </tr>
              <tr className="border-b border-[#262626]/50 h-10">
                <td className="py-2 text-[#A1A1A1]">AI Model (Generation)</td>
                <td className="py-2 font-mono">llama-3.1-70b-instruct</td>
              </tr>
              <tr className="border-b border-[#262626]/50 h-10">
                <td className="py-2 text-[#A1A1A1]">AI Model (Extraction)</td>
                <td className="py-2 font-mono">llama-3.1-8b-instant</td>
              </tr>
              <tr className="border-b border-[#262626]/50 h-10">
                <td className="py-2 text-[#A1A1A1]">Max Budget per Test</td>
                <td className="py-2 font-mono tabular-nums">$500</td>
              </tr>
              <tr className="h-10">
                <td className="py-2 text-[#A1A1A1]">Health Check Interval</td>
                <td className="py-2 font-mono">15 min</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Status of required environment variables</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {[
                'META_APP_ID',
                'META_APP_SECRET',
                'GROQ_API_KEY',
                'NEXT_PUBLIC_SUPABASE_URL',
                'SUPABASE_SERVICE_ROLE',
                'CLERK_SECRET_KEY',
              ].map((key) => (
                <tr key={key} className="border-b border-[#262626]/50 h-10">
                  <td className="py-2 text-[#A1A1A1] font-mono text-xs w-64">{key}</td>
                  <td className="py-2">
                    <Badge variant="outline">Not configured</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
