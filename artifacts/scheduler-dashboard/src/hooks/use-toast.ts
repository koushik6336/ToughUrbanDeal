import { toast as sonnerToast } from "sonner"

export const toast = ({
  title,
  description,
  variant,
}: {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}) => {
  if (variant === "destructive") {
    sonnerToast.error(title, { description })
  } else {
    sonnerToast(title, { description })
  }
}

export const useToast = () => {
  return { toast }
}
