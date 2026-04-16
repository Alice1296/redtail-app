const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://fjtxycgdtciyizvuhnqa.supabase.co'
const supabaseAnonKey = 'sb_publishable_T03geZJ6fI-jrjY1bh6GDA_AgCu_buQ'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const trainerId = '468d8851-7a5d-41f7-bdba-926b3d5591b7'
const trainerEmail = 'dainellialice@gmail.com'

async function setupTrainer() {
  try {
    console.log('🔍 Verificando profilo trainer...')
    
    // Verifica se il profilo esiste
    const { data: existingProfile, error: selectError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', trainerId)
      .maybeSingle()

    if (selectError) {
      console.error('❌ Errore nel recupero:', selectError.message)
      return
    }

    if (existingProfile) {
      console.log('✅ Profilo trovato:', existingProfile)
      
      if (existingProfile.role === 'trainer') {
        console.log('✅ L\'utente è già configurato come TRAINER')
      } else {
        console.log('⚠️  L\'utente NON è un trainer. Aggiornamento...')
        const { data: updated, error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'trainer' })
          .eq('id', trainerId)
          .select()

        if (updateError) {
          console.error('❌ Errore nell\'aggiornamento:', updateError.message)
        } else {
          console.log('✅ Aggiornato con successo:', updated)
        }
      }
    } else {
      console.log('ℹ️  Profilo non trovato nel database.')
      console.log('➡️  IMPORTANTE: L\'utente deve fare login almeno una volta prima.')
      console.log('➡️  Dopo il login, ripeti questo script.')
    }

    console.log('\n✅ Setup completato!')
    console.log(`📧 Email: ${trainerEmail}`)
    console.log(`🆔 UID: ${trainerId}`)
    console.log(`🎯 Ruolo: trainer`)
    
  } catch (err) {
    console.error('❌ Errore:', err.message)
  }
}

setupTrainer()
