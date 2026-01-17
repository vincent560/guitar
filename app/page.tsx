// app/page.tsx
import GuitarTab from "./components/GuitarTab";

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gray-100 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">
        我的吉他譜編輯器 Demo
      </h1>
      
      <div className="w-full max-w-4xl">
        <GuitarTab />
      </div>
    </main>
  );
}