import React from 'react'

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button style={{ padding: '8px 12px', borderRadius: 8 }} {...props} />
}
