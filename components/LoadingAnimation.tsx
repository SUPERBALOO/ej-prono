type LoadingAnimationProps = {
  message: string;
  fullScreen?: boolean;
};

export default function LoadingAnimation({
  message,
  fullScreen = false,
}: LoadingAnimationProps) {
  return (
    <div
      className={
        fullScreen
          ? "min-h-screen bg-[#1E3047] flex flex-col items-center justify-center text-white"
          : "bg-[#33465D] rounded-3xl p-8 md:p-12 text-center text-white flex flex-col items-center justify-center min-h-[220px]"
      }
    >
      <img
        src="/logo-ej-prono.png"
        alt="EJ Prono"
        className="w-36 md:w-48 mb-8"
      />

      <div className="ballon text-5xl md:text-6xl">
        ⚽
      </div>

      <p className="mt-6 text-xl md:text-2xl font-semibold text-[#D8AA82]">
        {message}
      </p>

      <div className="flex gap-2 mt-4">
        <div className="w-3 h-3 bg-[#D8AA82] rounded-full animate-bounce" />
        <div
          className="w-3 h-3 bg-[#D8AA82] rounded-full animate-bounce"
          style={{ animationDelay: "0.15s" }}
        />
        <div
          className="w-3 h-3 bg-[#D8AA82] rounded-full animate-bounce"
          style={{ animationDelay: "0.3s" }}
        />
      </div>
    </div>
  );
}
