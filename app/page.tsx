export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">Evacuation Simulator</h1>
      <p className="text-gray-400 mb-8">Web-based crowd evacuation simulation platform</p>
      <div className="flex gap-4">
        
          <a href="/simulate"
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
        >
          Go to Simulator
        </a>
        
          <a href="/analysis"
          className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-semibold"
        >
          Go to Analysis
        </a>
      </div>
    </main>
  )
}