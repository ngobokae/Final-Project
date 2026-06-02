import React from "react";
import { cn } from "../../utils/cn";

export const Slider = React.forwardRef(({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
  const handleChange = (e) => {
    if (onValueChange) {
      onValueChange([parseFloat(e.target.value)]);
    }
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value ? value[0] : 0}
      onChange={handleChange}
      className={cn(
        "w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary dark:bg-neutral-800",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Slider.displayName = "Slider";
