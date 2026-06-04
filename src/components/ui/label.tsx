import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cn } from "@/lib/utils"

type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>

function LabelComponent(
  { className, ...props }: LabelProps,
  ref: React.ForwardedRef<React.ElementRef<typeof LabelPrimitive.Root>>
) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
}

const Label = React.forwardRef(LabelComponent)
Label.displayName = LabelPrimitive.Root.displayName

export { Label }