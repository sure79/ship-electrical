'use client'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div style={{
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      minHeight:'100vh',padding:24,textAlign:'center',background:'#f0f4f8'
    }}>
      <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
      <h2 style={{fontSize:18,fontWeight:800,color:'#c62828',marginBottom:8}}>
        오류가 발생했습니다
      </h2>
      <p style={{fontSize:13,color:'#546e7a',marginBottom:4,maxWidth:400}}>
        {error?.message || '알 수 없는 오류'}
      </p>
      <p style={{fontSize:11,color:'#90a4ae',marginBottom:20}}>
        브라우저 콘솔에서 상세 내용을 확인할 수 있습니다.
      </p>
      <button
        onClick={reset}
        style={{
          background:'#1565c0',color:'#fff',border:'none',borderRadius:8,
          padding:'10px 24px',fontSize:14,fontWeight:700,cursor:'pointer'
        }}
      >
        다시 시도
      </button>
    </div>
  )
}
