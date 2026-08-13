"use client";

export function ConfirmDeleteButton({
  label = "Delete",
  message = "Delete this record? This cannot be undone.",
  className = "btn btn-danger text-xs",
}: {
  label?: string;
  message?: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
