export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="relative">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20"></div>
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent 
          absolute top-0 left-0"></div>
      </div>
    </div>
  );
}
