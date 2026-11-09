import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'selected' | 'ghost' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BASE_BUTTON_CLASSES =
  'inline-flex items-center justify-center gap-1.5 font-medium rounded-full transition-all duration-150 select-none cursor-pointer max-w-full whitespace-normal text-center leading-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] enabled:active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100 disabled:cursor-not-allowed';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#111111] text-white border border-[#111111] shadow-[0_1px_2px_rgba(17,17,17,0.14)] enabled:hover:bg-[#262626] enabled:hover:border-[#262626] enabled:active:bg-[#000000]',
  secondary:
    'bg-white/95 text-[#111111] border border-[#D4D4D8] shadow-[0_1px_2px_rgba(17,17,17,0.04)] enabled:hover:bg-[#F4F4F6] enabled:hover:border-[#111111] enabled:active:bg-[#E8E8ED]',
  selected:
    'bg-[#111111] text-white border border-[#111111] shadow-[0_2px_5px_rgba(17,17,17,0.18)] enabled:hover:bg-[#222222]',
  ghost:
    'bg-transparent text-[#555555] border border-transparent enabled:hover:text-[#111111] enabled:hover:bg-[#F2F2F7] enabled:active:bg-[#E5E5EA]',
  icon:
    'bg-[#F4F4F6]/90 text-[#444444] border border-[#E5E5EA] enabled:hover:text-[#111111] enabled:hover:bg-[#E8E8ED] enabled:hover:border-[#111111] enabled:active:bg-[#DCDCE2]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] h-auto px-3.5 py-1.5 text-xs',
  md: 'min-h-[42px] h-auto px-4.5 py-2 text-sm',
  lg: 'min-h-[46px] h-auto px-5.5 py-2.5 text-sm',
  'icon-sm': 'w-8 h-8 min-w-[32px] min-h-[32px] p-0 shrink-0',
  'icon-md': 'w-9 h-9 min-w-[36px] min-h-[36px] p-0 shrink-0',
};

export function getButtonClassName(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  extraClassName = ''
): string {
  return `${BASE_BUTTON_CLASSES} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${extraClassName}`.trim();
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className = '', type = 'button', children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={getButtonClassName(variant, size, className)}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
