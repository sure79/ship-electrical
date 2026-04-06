'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Project page error:', error)
  }, [error])

  return (
    <div style={{
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      minHeight:'60vh',padding:24,textAlign:'center'
    }}>
      <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
      <h2 style={{fontSize:18,fontWeight:800,color:'#c62828',marginBottom:8}}>
        페이지 오류
      </h2>
      <p style={{fontSize:13,color:'#546e7a',marginBottom:4,maxWidth:400}}>
        {error?.message || '프로젝트 데이터를 불러오는 중 오류가 발생했습니다.'}
      </p>
      <p style={{fontSize:11,color:'#90a4ae',marginBottom:20}}>
        네트워크 연결을 확인하거나 다시 시도해 주세요.
      </p>
      <div style={{display:'flex',gap:10}}>
        <button
          onClick={reset}
          style={{
            background:'#1565c0',color:'#fff',border:'none',borderRadius:8,
            padding:'10px 20px',fontSize:13,fontWeight:700,cursor:'pointer'
          }}
        >
          다시 시도
        </button>
        <button
          onClick={()=>router.push('/')}
          style={{
            background:'#fff',color:'#1565c0',border:'1px solid #1565c0',borderRadius:8,
            padding:'10px 20px',fontSize:13,fontWeight:700,cursor:'pointer'
          }}
        >
          홈으로
        </button>
      </div>
    </div>
  )
}
