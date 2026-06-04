import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useContact, useContactTypes, useSalutations } from '@/hooks/useContacts'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save } from 'lucide-react'

export default function ContactForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const { data: existingContact } = useContact(id ?? '')
  const { data: contactTypes } = useContactTypes()
  const { data: salutations } = useSalutations()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  const [form, setForm] = useState({
    is_company: false,
    salutation_id: '',
    title: '',
    first_name: '',
    last_name: '',
    company_name: '',
    department: '',
    position: '',
    email_main: '',
    phone_main: '',
    mobile_main: '',
    website: '',
    tax_number: '',
    vat_id: '',
    customer_number: '',
    supplier_number: '',
    employee_number: '',
    birthday: '',
    notes: '',
    // Adresse
    street: '',
    street_number: '',
    address_extra: '',
    postal_code: '',
    city: '',
    state: '',
    country: 'Deutschland',
  })

  // Bestehenden Kontakt laden beim Bearbeiten
  useEffect(() => {
    if (existingContact) {
      setForm({
        is_company: existingContact.is_company,
        salutation_id: existingContact.salutation_id ?? '',
        title: existingContact.title ?? '',
        first_name: existingContact.first_name ?? '',
        last_name: existingContact.last_name ?? '',
        company_name: existingContact.company_name ?? '',
        department: existingContact.department ?? '',
        position: existingContact.position ?? '',
        email_main: existingContact.email_main ?? '',
        phone_main: existingContact.phone_main ?? '',
        mobile_main: existingContact.mobile_main ?? '',
        website: existingContact.website ?? '',
        tax_number: existingContact.tax_number ?? '',
        vat_id: existingContact.vat_id ?? '',
        customer_number: existingContact.customer_number ?? '',
        supplier_number: existingContact.supplier_number ?? '',
        employee_number: existingContact.employee_number ?? '',
        birthday: existingContact.birthday ?? '',
        notes: existingContact.notes ?? '',
        street: existingContact.contact_addresses?.[0]?.street ?? '',
        street_number: existingContact.contact_addresses?.[0]?.street_number ?? '',
        address_extra: existingContact.contact_addresses?.[0]?.address_extra ?? '',
        postal_code: existingContact.contact_addresses?.[0]?.postal_code ?? '',
        city: existingContact.contact_addresses?.[0]?.city ?? '',
        state: existingContact.contact_addresses?.[0]?.state ?? '',
        country: existingContact.contact_addresses?.[0]?.country ?? 'Deutschland',
      })
      setSelectedTypes(
        existingContact.contact_type_assignments?.map(a => a.contact_types.id) ?? []
      )
    }
  }, [existingContact])

  const set = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleType = (typeId: string) => {
    setSelectedTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const contactData = {
        is_company: form.is_company,
        salutation_id: form.salutation_id || null,
        title: form.title || null,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        company_name: form.company_name || null,
        department: form.department || null,
        position: form.position || null,
        email_main: form.email_main || null,
        phone_main: form.phone_main || null,
        mobile_main: form.mobile_main || null,
        website: form.website || null,
        tax_number: form.tax_number || null,
        vat_id: form.vat_id || null,
        customer_number: form.customer_number || null,
        supplier_number: form.supplier_number || null,
        employee_number: form.employee_number || null,
        birthday: form.birthday || null,
        notes: form.notes || null,
        created_by: user?.id,
      }

      let contactId = id

      if (isEdit) {
        const { error } = await supabase
          .from('contacts')
          .update(contactData)
          .eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert(contactData)
          .select('id')
          .single()
        if (error) throw error
        contactId = data.id
      }

      // Adresse speichern
      if (form.street || form.city || form.postal_code) {
        if (isEdit && existingContact?.contact_addresses?.[0]?.id) {
          await supabase
            .from('contact_addresses')
            .update({
              street: form.street || null,
              street_number: form.street_number || null,
              address_extra: form.address_extra || null,
              postal_code: form.postal_code || null,
              city: form.city || null,
              state: form.state || null,
              country: form.country || null,
            })
            .eq('id', existingContact.contact_addresses[0].id)
        } else {
          await supabase
            .from('contact_addresses')
            .insert({
              contact_id: contactId,
              address_type: 'Haupt',
              street: form.street || null,
              street_number: form.street_number || null,
              address_extra: form.address_extra || null,
              postal_code: form.postal_code || null,
              city: form.city || null,
              state: form.state || null,
              country: form.country || null,
              is_primary: true,
            })
        }
      }

      // Kontaktarten speichern
      await supabase
        .from('contact_type_assignments')
        .delete()
        .eq('contact_id', contactId)

      if (selectedTypes.length > 0) {
        await supabase
          .from('contact_type_assignments')
          .insert(selectedTypes.map(typeId => ({
            contact_id: contactId,
            contact_type_id: typeId,
          })))
      }

      navigate('/contacts')
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEdit ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
          </h1>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6">

        {/* Art des Kontakts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Art des Kontakts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Firma oder Person */}
            <div className="flex gap-3">
              <button
                onClick={() => set('is_company', false)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                  !form.is_company
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                👤 Person
              </button>
              <button
                onClick={() => set('is_company', true)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                  form.is_company
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                🏢 Firma
              </button>
            </div>

            {/* Kontaktarten */}
            <div>
              <Label className="mb-2 block">Kontaktarten (mehrere möglich)</Label>
              <div className="flex flex-wrap gap-2">
                {contactTypes?.map(type => (
                  <button
                    key={type.id}
                    onClick={() => toggleType(type.id)}
                    className="transition-transform hover:scale-105"
                  >
                    <Badge
                      style={{
                        backgroundColor: selectedTypes.includes(type.id)
                          ? (type.color ?? '#6b7280')
                          : 'transparent',
                        borderColor: type.color ?? '#6b7280',
                        color: selectedTypes.includes(type.id) ? 'white' : (type.color ?? '#6b7280'),
                        border: '2px solid',
                      }}
                      className="cursor-pointer px-3 py-1 text-sm"
                    >
                      {type.name}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Persönliche Daten */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {form.is_company ? 'Firmendaten' : 'Persönliche Daten'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!form.is_company && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Anrede</Label>
                  <Select
                    value={form.salutation_id}
                    onValueChange={v => set('salutation_id', v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Anrede" />
                    </SelectTrigger>
                    <SelectContent>
                      {salutations?.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Titel</Label>
                  <Input
                    className="mt-1"
                    placeholder="Dr., Prof. etc."
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                  />
                </div>
                <div />
              </div>
            )}

            {!form.is_company && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vorname</Label>
                  <Input
                    className="mt-1"
                    placeholder="Vorname"
                    value={form.first_name}
                    onChange={e => set('first_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Nachname</Label>
                  <Input
                    className="mt-1"
                    placeholder="Nachname"
                    value={form.last_name}
                    onChange={e => set('last_name', e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Firma</Label>
                <Input
                  className="mt-1"
                  placeholder="Firmenname"
                  value={form.company_name}
                  onChange={e => set('company_name', e.target.value)}
                />
              </div>
              <div>
                <Label>Abteilung</Label>
                <Input
                  className="mt-1"
                  placeholder="Abteilung"
                  value={form.department}
                  onChange={e => set('department', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Position / Funktion</Label>
              <Input
                className="mt-1"
                placeholder="z.B. Geschäftsführer, Einkaufsleiter"
                value={form.position}
                onChange={e => set('position', e.target.value)}
              />
            </div>

            {!form.is_company && (
              <div>
                <Label>Geburtstag</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={form.birthday}
                  onChange={e => set('birthday', e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kommunikation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kommunikation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>E-Mail (Haupt)</Label>
                <Input
                  className="mt-1"
                  type="email"
                  placeholder="name@firma.de"
                  value={form.email_main}
                  onChange={e => set('email_main', e.target.value)}
                />
              </div>
              <div>
                <Label>Website</Label>
                <Input
                  className="mt-1"
                  placeholder="www.firma.de"
                  value={form.website}
                  onChange={e => set('website', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefon</Label>
                <Input
                  className="mt-1"
                  placeholder="+49 30 123456"
                  value={form.phone_main}
                  onChange={e => set('phone_main', e.target.value)}
                />
              </div>
              <div>
                <Label>Mobil</Label>
                <Input
                  className="mt-1"
                  placeholder="+49 170 123456"
                  value={form.mobile_main}
                  onChange={e => set('mobile_main', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Adresse */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Adresse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>Straße</Label>
                <Input
                  className="mt-1"
                  placeholder="Straße"
                  value={form.street}
                  onChange={e => set('street', e.target.value)}
                />
              </div>
              <div>
                <Label>Hausnummer</Label>
                <Input
                  className="mt-1"
                  placeholder="Nr."
                  value={form.street_number}
                  onChange={e => set('street_number', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Adresszusatz</Label>
              <Input
                className="mt-1"
                placeholder="c/o, Gebäude, Etage..."
                value={form.address_extra}
                onChange={e => set('address_extra', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>PLZ</Label>
                <Input
                  className="mt-1"
                  placeholder="PLZ"
                  value={form.postal_code}
                  onChange={e => set('postal_code', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Label>Stadt</Label>
                <Input
                  className="mt-1"
                  placeholder="Stadt"
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bundesland</Label>
                <Input
                  className="mt-1"
                  placeholder="Bundesland"
                  value={form.state}
                  onChange={e => set('state', e.target.value)}
                />
              </div>
              <div>
                <Label>Land</Label>
                <Input
                  className="mt-1"
                  placeholder="Deutschland"
                  value={form.country}
                  onChange={e => set('country', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Buchhaltung */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buchhaltung & Nummern</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kundennummer</Label>
                <Input
                  className="mt-1"
                  placeholder="K-0001"
                  value={form.customer_number}
                  onChange={e => set('customer_number', e.target.value)}
                />
              </div>
              <div>
                <Label>Lieferantennummer</Label>
                <Input
                  className="mt-1"
                  placeholder="L-0001"
                  value={form.supplier_number}
                  onChange={e => set('supplier_number', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Steuernummer</Label>
                <Input
                  className="mt-1"
                  placeholder="12/345/67890"
                  value={form.tax_number}
                  onChange={e => set('tax_number', e.target.value)}
                />
              </div>
              <div>
                <Label>USt-IdNr.</Label>
                <Input
                  className="mt-1"
                  placeholder="DE123456789"
                  value={form.vat_id}
                  onChange={e => set('vat_id', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Personalnummer</Label>
              <Input
                className="mt-1"
                placeholder="P-0001"
                value={form.employee_number}
                onChange={e => set('employee_number', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notizen */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notizen</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full min-h-32 p-3 rounded-md border border-input bg-background text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Interne Notizen zum Kontakt..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Speichern */}
        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={() => navigate('/contacts')}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Wird gespeichert...' : 'Kontakt speichern'}
          </Button>
        </div>
      </div>
    </div>
  )
}