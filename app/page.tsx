import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LandingPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
      <div className="text-center space-y-8 px-4">
        <h1 className="text-5xl font-bold text-gray-900">
          CB <span className="text-primary-500">Connect</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-md mx-auto">
          Track cycles, manage pain, and stay connected with your partner.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-in"
            className="px-8 py-3 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="px-8 py-3 border-2 border-primary-500 text-primary-500 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
