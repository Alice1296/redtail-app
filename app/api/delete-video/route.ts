import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  try {
    const { filePath } = await req.json()
    
    if (!filePath) {
      return NextResponse.json({ error: 'filePath required' }, { status: 400 })
    }

    // Crea client con service role key (bypassa RLS)
    const supabase = createServerClient(supabaseUrl, supabaseServiceKey, {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
    })

    // Cancella il file dal bucket
    const { error } = await supabase.storage.from('videos').remove([filePath])

    if (error) {
      console.error('❌ Storage delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log('✅ File eliminato via API:', filePath)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('❌ API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
