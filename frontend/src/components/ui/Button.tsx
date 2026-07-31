import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react'
import { useTheme } from '../../context/ThemeContext'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
}

const SIZE_CLS: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
}

const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', icon, loading, disabled, className = '', children, style, ...rest }, ref) => {
    const { colors } = useTheme()
    const base =
      'inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap'

    const variantCls: Record<Variant, string> = {
      primary: 'text-white hover:opacity-90',
      secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
      danger: 'bg-rose-600 text-white hover:bg-rose-700',
      ghost: 'text-slate-500 hover:bg-slate-100',
    }

    const variantStyle = variant === 'primary' ? { backgroundColor: colors.primary, ...style } : style

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${SIZE_CLS[size]} ${variantCls[variant]} ${className}`}
        style={variantStyle}
        {...rest}
      >
        {loading ? (
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          icon
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button
