import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useContact, useContactTypes, useSalutations, useContactSearch } from '@/hooks/useContacts'
import { useIsAdmin } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, Plus, Trash2, UserPlus, Search } from 'lucide-react'

// Typen
type Address = {
  id?: string
  address_type: string
  street: string
  street_number: string
  address_extra: string
  postal_code: string
  city: string
  state: string
  country: string
  is_primary: boolean
}

type Communication = {
  id?: string
  comm_type: string
  value: string
  label: string
  is_primary: boolean
}

type ContactPerson = {
  id?: string
  related_id?: string
  salutation_id: string
  title: string
  first_name: string
  last_name: string
  position: string
  email: string
  phone: string
  mobile: string
  isNew?: boolean
}

const LEGAL_FORMS = [
  'Einzelfirma', 'GmbH', 'UG (hb)', 'AG', 'e.G.', 'e.V.',
  'GbR', 'OHG', 'KG', 'GmbH & Co. KG', 'Freiberufler', 'Sonstige'
]

const COMM_TYPES = [
  { value: 'email', label: 'E-Mail' },
  { value: 'phone', label: 'Telefon' },
  { value: 'mobile', label: 'Mobil' },
  { value: 'fax', label: 'Fax' },
  { value: 'web', label: 'Website' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'xing', label: 'Xing' },
  { value: 'sonstige', label: 'Sonstige' },
]

const ADDRESS_TYPES = ['Haupt', 'Lieferung', 'Rechnung', 'Privat', 'Sonstige']

const emptyAddress = (): Address => ({
  address_type: 'Haupt',
  street: '',
  street_number: '',
  address_extra: '',
  postal_code: '',
  city: '',
  state: '',
  country: 'Deutschland',
  is_primary: false,
})

const emptyCommunication = (): Communication => ({
  comm_type: 'email',
  value: '',
  label: '',
  is_primary: false,
})

const emptyContactPerson = (): ContactPerson => ({
  salutation_id: '',
  title: '',
  first_name: '',
  last_name: '',
  position: '',
  email: '',
  phone: '',
  mobile: '',
  isNew: true,
})

export default function ContactForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const isAdmin = useIsAdmin()

  const { data: existingContact } = useContact(id ?? '')
  const { data: contactTypes } = useContactTypes()
  const { data: salutations } = useSalutations()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [addresses, setAddresses] = useState<Address[]>([emptyAddress()])
  const [communications, setCommunications] = useState<Communication[]>([emptyCommunication()])
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([])
  const [personSearch, setPersonSearch] = useState('')
  const [showPersonSearch, setShowPersonSearch] = useState(false)
  const { data: searchResults } = useContactSearch(personSearch)

  const [form, setForm] = useState({
    is_company: false,
    visibility: 'public',
    salutation_id: '',
    title: '',
    first_name: '',
    last_name: '',
    company_name: '',
    legal_form: '',
    register_info: '',
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
  })

  // Bestehenden Kontakt laden
  useEffect(() => {
    if (!existingContact) return

    setForm({
      is_company: existingContact.is_company,
      visibility: existingContact.visibility ?? 'public',
      salutation_id: existingContact.salutation_id ?? '',
      title: existingContact.title ?? '',
      first_name: existingContact.first_name ?? '',
      last_name: existingContact.last_name ?? '',
      company_name: existingContact.company_name ?? '',
      legal_form: existingContact.legal_form ?? '',
      register_info: existingContact.register_info ?? '',
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
    })

    setSelectedTypes(
      existingContact.contact_type_assignments?.map(a => a.contact_types.id) ?? []
    )

    if (existingContact.contact_addresses?.length > 0) {
      setAddresses(existingContact.contact_addresses.map(a => ({
        id: a.id,
        address_type: a.address_type,
        street: a.street ?? '',
        street_number: a.street_number ?? '',
        address_extra: a.address_extra ?? '',
        postal_code: a.postal_code ?? '',
        city: a.city ?? '',
        state: a.state ?? '',
        country: a.country ?? 'Deutschland',
        is_primary: a.is_primary,
      })))
    }

    if (existingContact.contact_communications?.length > 0) {
      setCommunications(existingContact.contact_communications.map(c => ({
        id: c.id,
        comm_type: c.comm_type,
        value: c.value,
        label: c.label ?? '',
        is_primary: c.is_primary,
      })))
    }

    if (existingContact.contact_relations_contact_id?.length > 0) {
      setContactPersons(
        existingContact.contact_relations_contact_id.map(r => ({
          id: r.id,
          related_id: r.related.id,
          salutation_id: r.related.salutation_id ?? '',
          title: r.related.title ?? '',
          first_name: r.related.first_name ?? '',
          last_name: r.related.last_name ?? '',
          position: r.related.position ?? '',
          email: r.related.email_main ?? '',
          phone: r.related.phone_main ?? '',
          mobile: r.related.mobile_main ?? '',
          isNew: false,
        }))
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

  // Adressen
  const addAddress = () => setAddresses(prev => [...prev, emptyAddress()])
  const removeAddress = (i: number) => setAddresses(prev => prev.filter((_, j) => j !== i))
  const setAddress = (i: number, field: string, value: string | boolean) => {
    setAddresses(prev => prev.map((a, j) => j === i ? { ...a, [field]: value } : a))
  }

  // Kommunikation
  const addCommunication = () => setCommunications(prev => [...prev, emptyCommunication()])
  const removeCommunication = (i: number) => setCommunications(prev => prev.filter((_, j) => j !== i))
  const setCommunication = (i: number, field: string, value: string | boolean) => {
    setCommunications(prev => prev.map((c, j) => j === i ? { ...c, [field]: value } : c))
  }

  // Ansprechpartner
  const addContactPerson = () => setContactPersons(prev => [...prev, emptyContactPerson()])
  const removeContactPerson = (i: number) => setContactPersons(prev => prev.filter((_, j) => j !== i))
  const setContactPerson = (i: number, field: string, value: string) => {
    setContactPersons(prev => prev.map((p, j) => j === i ? { ...p, [field]: value } : p))
  }

  const addExistingPerson = (person: any) => {
    setContactPersons(prev => [...prev, {
      related_id: person.id,
      salutation_id: '',
      title: '',
      first_name: person.first_name ?? '',
      last_name: person.last_name ?? '',
      position: person.position ?? '',
      email: person.email_main ?? '',
      phone: '',
      mobile: '',
      isNew: false,
    }])
    setShowPersonSearch(false)
    setPersonSearch('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const contactData = {
        is_company: form.is_company,
        visibility: form.visibility,
        salutation_id: form.salutation_id || null,
        title: form.title || null,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        company_name: form.company_name || null,
        legal_form: form.legal_form || null,
        register_info: form.register_info || null,
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

      // Adressen speichern
      if (isEdit) {
        await supabase.from('contact_addresses').delete().eq('contact_id', contactId)
      }
      const validAddresses = addresses.filter(a => a.street || a.city || a.postal_code)
      if (validAddresses.length > 0) {
        await supabase.from('contact_addresses').insert(
          validAddresses.map((a, i) => ({
            contact_id: contactId,
            address_type: a.address_type,
            street: a.street || null,
            street_number: a.street_number || null,
            address_extra: a.address_extra || null,
            postal_code: a.postal_code || null,
            city: a.city || null,
            state: a.state || null,
            country: a.country || null,
            is_primary: i === 0,
          }))
        )
      }

      // Kommunikation speichern
      if (isEdit) {
        await supabase.from('contact_communications').delete().eq('contact_id', contactId)
      }
      const validComms = communications.filter(c => c.value)
      if (validComms.length > 0) {
        await supabase.from('contact_communications').insert(
          validComms.map((c, i) => ({
            contact_id: contactId,
            comm_type: c.comm_type,
            value: c.value,
            label: c.label || null,
            is_primary: i === 0,
          }))
        )
      }

      // Ansprechpartner speichern
      if (isEdit) {
        await supabase.from('contact_relations').delete().eq('contact_id', contactId)
      }

      for (const person of contactPersons) {
        let personId = person.related_id

        // Neue Person anlegen
        if (!personId) {
          const { data: newPerson, error: personError } = await supabase
            .from('contacts')
            .insert({
              is_company: false,
              salutation_id: person.salutation_id || null,
              title: person.title || null,
              first_name: person.first_name || null,
              last_name: person.last_name,
              position: person.position || null,
              email_main: person.email || null,
              phone_main: person.phone || null,
              mobile_main: person.mobile || null,
              created_by: user?.id,
            })
            .select('id')
            .single()
          if (personError) throw personError
          personId = newPerson.id
        }

        // Verknüpfung anlegen
        await supabase.from('contact_relations').insert({
          contact_id: contactId,
          related_id: personId,
          relation_type: 'ansprechpartner',
        })
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
        <h1 className="text-3xl font-bold text-gray-900">
          {isEdit ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6">

        {/* ── Art des Kontakts ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Art des Kontakts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Person / Firma */}
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

            {/* Sichtbarkeit – nur für Admins */}
            {isAdmin && (
              <div>
                <Label className="mb-2 block">Sichtbarkeit</Label>
                <div className="flex gap-3">
                  <button
                    onClick={() => set('visibility', 'public')}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                      form.visibility === 'public'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    🌍 Für alle sichtbar
                  </button>
                  <button
                    onClick={() => set('visibility', 'internal')}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                      form.visibility === 'internal'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    🔒 Nur intern
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Firmendaten ── */}
        {form.is_company && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Firmendaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Firmenname</Label>
                  <Input
                    className="mt-1"
                    placeholder="Firmenname"
                    value={form.company_name}
                    onChange={e => set('company_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Rechtsform</Label>
                  <Input
                    className="mt-1"
                    placeholder="z.B. GmbH, AG, e.V. ..."
                    value={form.legal_form}
                    onChange={e => set('legal_form', e.target.value)}
                    list="legal-forms"
                  />
                  <datalist id="legal-forms">
                    {LEGAL_FORMS.map(f => <option key={f} value={f} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name Inhaber/Organ</Label>
                  <Input
                    className="mt-1"
                    placeholder="z.B. Geschäftsführer, Vorstand"
                    value={form.position}
                    onChange={e => set('position', e.target.value)}
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
                <Label>Registergericht und Registernummer</Label>
                <Input
                  className="mt-1"
                  placeholder="z.B. Amtsgericht Berlin HRB 12345"
                  value={form.register_info}
                  onChange={e => set('register_info', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Persönliche Daten (nur für Personen) ── */}
        {!form.is_company && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Persönliche Daten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <div>
                  <Label>Geburtstag</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={form.birthday}
                    onChange={e => set('birthday', e.target.value)}
                  />
                </div>
              </div>

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
            </CardContent>
          </Card>
        )}

        {/* ── Ansprechpartner (nur bei Firma) ── */}
        {form.is_company && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Ansprechpartner</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPersonSearch(!showPersonSearch)}
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    Vorhandenen suchen
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addContactPerson}
                    className="gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Neu anlegen
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Personensuche */}
              {showPersonSearch && (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <Label className="mb-2 block">Bestehenden Kontakt suchen</Label>
                  <Input
                    placeholder="Name oder E-Mail eingeben..."
                    value={personSearch}
                    onChange={e => setPersonSearch(e.target.value)}
                  />
                  {searchResults && searchResults.length > 0 && (
                    <div className="mt-2 border rounded-md bg-white shadow-sm">
                      {searchResults.map(p => (
                        <button
                          key={p.id}
                          onClick={() => addExistingPerson(p)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                        >
                          <span className="font-medium">
                            {[p.first_name, p.last_name].filter(Boolean).join(' ')}
                          </span>
                          {p.email_main && (
                            <span className="text-gray-400 ml-2">{p.email_main}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {contactPersons.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Noch keine Ansprechpartner hinzugefügt
                </p>
              )}

              {contactPersons.map((person, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-700">
                      Ansprechpartner {i + 1}
                      {!person.isNew && person.related_id && (
                        <span className="ml-2 text-xs text-blue-600">(bestehender Kontakt)</span>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeContactPerson(i)}
                      className="text-destructive hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Anrede</Label>
                      <Select
                        value={person.salutation_id}
                        onValueChange={v => setContactPerson(i, 'salutation_id', v)}
                      >
                        <SelectTrigger className="mt-1 h-9">
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
                      <Label className="text-xs">Titel</Label>
                      <Input
                        className="mt-1 h-9"
                        placeholder="Dr., Prof."
                        value={person.title}
                        onChange={e => setContactPerson(i, 'title', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Position</Label>
                      <Input
                        className="mt-1 h-9"
                        placeholder="z.B. Einkauf"
                        value={person.position}
                        onChange={e => setContactPerson(i, 'position', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Vorname</Label>
                      <Input
                        className="mt-1 h-9"
                        placeholder="Vorname"
                        value={person.first_name}
                        onChange={e => setContactPerson(i, 'first_name', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Nachname *</Label>
                      <Input
                        className="mt-1 h-9"
                        placeholder="Nachname"
                        value={person.last_name}
                        onChange={e => setContactPerson(i, 'last_name', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">E-Mail</Label>
                      <Input
                        className="mt-1 h-9"
                        placeholder="email@firma.de"
                        value={person.email}
                        onChange={e => setContactPerson(i, 'email', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Telefon</Label>
                      <Input
                        className="mt-1 h-9"
                        placeholder="+49 30 ..."
                        value={person.phone}
                        onChange={e => setContactPerson(i, 'phone', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Mobil</Label>
                      <Input
                        className="mt-1 h-9"
                        placeholder="+49 170 ..."
                        value={person.mobile}
                        onChange={e => setContactPerson(i, 'mobile', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Kommunikation ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Kommunikation</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={addCommunication}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Hinzufügen
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {communications.map((comm, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3">
                  <Select
                    value={comm.comm_type}
                    onValueChange={v => setCommunication(i, 'comm_type', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMM_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  <Input
                    placeholder="Wert"
                    value={comm.value}
                    onChange={e => setCommunication(i, 'value', e.target.value)}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    placeholder="Label (z.B. Büro)"
                    value={comm.label}
                    onChange={e => setCommunication(i, 'label', e.target.value)}
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCommunication(i)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Adressen ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Adressen</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={addAddress}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Hinzufügen
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {addresses.map((addr, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Select
                    value={addr.address_type}
                    onValueChange={v => setAddress(i, 'address_type', v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADDRESS_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {addresses.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAddress(i)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Straße</Label>
                    <Input
                      className="mt-1"
                      placeholder="Straße"
                      value={addr.street}
                      onChange={e => setAddress(i, 'street', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Hausnummer</Label>
                    <Input
                      className="mt-1"
                      placeholder="Nr."
                      value={addr.street_number}
                      onChange={e => setAddress(i, 'street_number', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Adresszusatz</Label>
                  <Input
                    className="mt-1"
                    placeholder="c/o, Gebäude, Etage..."
                    value={addr.address_extra}
                    onChange={e => setAddress(i, 'address_extra', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">PLZ</Label>
                    <Input
                      className="mt-1"
                      placeholder="PLZ"
                      value={addr.postal_code}
                      onChange={e => setAddress(i, 'postal_code', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Stadt</Label>
                    <Input
                      className="mt-1"
                      placeholder="Stadt"
                      value={addr.city}
                      onChange={e => setAddress(i, 'city', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Bundesland</Label>
                    <Input
                      className="mt-1"
                      placeholder="Bundesland"
                      value={addr.state}
                      onChange={e => setAddress(i, 'state', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Land</Label>
                    <Input
                      className="mt-1"
                      placeholder="Deutschland"
                      value={addr.country}
                      onChange={e => setAddress(i, 'country', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Buchhaltung & Nummern ── */}
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

        {/* ── Notizen ── */}
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

        {/* ── Speichern ── */}
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