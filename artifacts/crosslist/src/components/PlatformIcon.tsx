interface PlatformIconProps {
  name: string;
  size?: "sm" | "md";
}

export function PlatformIcon({ name, size = "sm" }: PlatformIconProps) {
  const sm = size === "sm";
  if (name === "poshmark") {
    return (
      <span className={`${sm ? "h-4 w-4 text-[10px]" : "h-6 w-6 text-xs"} rounded bg-pink-600 text-white flex items-center justify-center font-black shrink-0`}>
        P
      </span>
    );
  }
  if (name === "depop") {
    return (
      <span className={`${sm ? "h-4 w-4 text-[10px]" : "h-6 w-6 text-xs"} rounded bg-red-500 text-white flex items-center justify-center font-black shrink-0`}>
        D
      </span>
    );
  }
  if (name === "mercari") {
    return (
      <span className={`${sm ? "h-4 w-4 text-[10px]" : "h-6 w-6 text-xs"} rounded bg-red-700 text-white flex items-center justify-center font-black shrink-0`}>
        M
      </span>
    );
  }
  return (
    <span className={`${sm ? "h-4 w-4 text-[10px]" : "h-6 w-6 text-xs"} rounded bg-zinc-500 text-white flex items-center justify-center font-black shrink-0`}>
      {name[0]?.toUpperCase()}
    </span>
  );
}

export function PlatformLabel({ name }: { name: string }) {
  const labels: Record<string, string> = { poshmark: "Poshmark", depop: "Depop", mercari: "Mercari" };
  return <span>{labels[name] ?? name}</span>;
}
