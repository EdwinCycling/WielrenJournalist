import { useState } from 'react';
import { Play, Loader2, Terminal, FileText, Database, CheckCircle2, XCircle } from 'lucide-react';

interface ApiResponse {
  logs: string[];
  result: string;
}

interface NotionTestResponse {
  success: boolean;
  message: string;
}

function App() {
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [notionStatus, setNotionStatus] = useState<{ success: boolean; message: string } | null>(null);

  const startTestRun = async () => {
    setLoading(true);
    setLogs(['> Request verstuurd naar API (manual-trigger)...']);
    setResult(null);

    try {
      // Alleen tonen als we op localhost draaien
      if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
        setLogs(prev => [...prev, '⚠️ UI is alleen beschikbaar op localhost voor veiligheid.']);
        setLoading(false);
        return;
      }

      const response = await fetch('/.netlify/functions/manual-trigger', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      setLogs(data.logs);
      setResult(data.result);
    } catch (error: any) {
      setLogs((prev) => [...prev, `> Error: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const testNotionConnection = async () => {
    setTestLoading(true);
    setNotionStatus(null);
    try {
      // Alleen tonen als we op localhost draaien
      if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
        alert('Deze test is alleen lokaal beschikbaar.');
        return;
      }

      const response = await fetch('/.netlify/functions/test-notion', {
        method: 'POST',
      });
      const data: NotionTestResponse = await response.json();
      setNotionStatus(data);
    } catch (error: any) {
      setNotionStatus({ success: false, message: `Fout bij verbinden: ${error.message}` });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans text-gray-900">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
               <span className="text-2xl">🚴</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">WielerJournalist Dashboard</h1>
          </div>
          <div className="text-xs text-gray-400 font-mono">V2.0.0</div>
        </header>

        {/* Action Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Main Trigger */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Play className="w-5 h-5 text-blue-600" />
              Agent Run
            </h2>
            <p className="text-sm text-gray-500">Start de AI-agent om de laatste 2 dagen aan wielernieuws te verwerken en op te slaan.</p>
            <button
              onClick={startTestRun}
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                loading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Bezig...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Start Agent Test (2 dagen)
                </>
              )}
            </button>
          </section>

          {/* Notion Test */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-600" />
              Database Status
            </h2>
            <p className="text-sm text-gray-500">Controleer of de Notion API key en Database ID correct zijn geconfigureerd.</p>
            <button
              onClick={testNotionConnection}
              disabled={testLoading}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                testLoading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg'
              }`}
            >
              {testLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Controleren...
                </>
              ) : (
                <>
                  <Database className="w-5 h-5" />
                  Check Notion Verbinding
                </>
              )}
            </button>
            
            {notionStatus && (
              <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${notionStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {notionStatus.success ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{notionStatus.message}</span>
              </div>
            )}
          </section>
        </div>

        {/* Logs Console */}
        <section className="bg-gray-900 text-gray-100 p-6 rounded-xl shadow-md font-mono text-sm overflow-hidden border border-gray-800">
          <div className="flex items-center gap-2 mb-4 text-gray-400 border-b border-gray-700 pb-2">
            <Terminal className="w-4 h-4" />
            <span className="uppercase tracking-wider text-xs">System Logs</span>
          </div>
          <div className="space-y-1 h-64 overflow-y-auto custom-scrollbar">
            {logs.length === 0 ? (
              <span className="text-gray-600 italic">Wachten op actie...</span>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="break-words">
                  <span className="text-green-500 mr-2">➜</span>
                  {log}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Result Display */}
        {result && (
          <section className="bg-white p-8 rounded-xl shadow-md border border-gray-200 animate-fade-in">
             <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-800">Gegenereerd Verslag</h2>
            </div>
            <div className="prose prose-blue max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap italic">
              {result}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

export default App;
