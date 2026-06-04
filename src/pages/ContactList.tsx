import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts, useDeleteContact, type Contact } from '@/hooks/useContacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Search, Plus, Phone, Mail, Building2, User,
  Pencil, Trash2, Eye
} from 'lucide-react'

export default function ContactList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { data: contacts, isLoading, error } = useContacts(search)
  const deleteContact = useDeleteContact()

  const getDisplayName = (contact: Contact) => {
    if (contact.is_company) return contact.company_name ?? '–'
    const parts = [contact.first_name, contact.last_name].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : '–'
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Kontakt "${name}" wirklich deaktivieren?`)) {
      await deleteContact.mutateAsync(id)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kontakte</h1>
          <p className="text-gray-500 mt-1">
            {contacts?.length ?? 0} Kontakte gefunden
          </p>
        </div>
        <Button onClick={() => navigate('/contacts/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          Neuer Kontakt
        </Button>
      </div>

      {/* Suche */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Suche nach Name, Firma, E-Mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11"
        />
      </div>

      {/* Fehler */}
      {error && (
        <Card className="border-destructive mb-4">
          <CardContent className="pt-4 text-destructive">
            Fehler beim Laden der Kontakte. Bitte Seite neu laden.
          </CardContent>
        </Card>
      )}

      {/* Laden */}
      {isLoading && (
        <div className="grid gap-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Kontakte Liste */}
      {!isLoading && contacts && (
        <div className="grid gap-3">
          {contacts.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg">Keine Kontakte gefunden</p>
                <p className="text-sm mt-1">Lege deinen ersten Kontakt an</p>
              </CardContent>
            </Card>
          )}

          {contacts.map(contact => (
            <Card key={contact.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-lg
                    ${contact.is_company ? 'bg-indigo-500' : 'bg-blue-500'}
                  `}>
                    {contact.is_company
                      ? <Building2 className="h-6 w-6" />
                      : (contact.first_name?.[0] ?? contact.last_name?.[0] ?? '?')
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 truncate">
                        {getDisplayName(contact)}
                      </span>
                      {/* Kontaktarten Badges */}
                      {contact.contact_type_assignments?.map(a => (
                        <Badge
                          key={a.contact_types.id}
                          style={{ backgroundColor: a.contact_types.color ?? '#6b7280' }}
                          className="text-white border-0 text-xs"
                        >
                          {a.contact_types.name}
                        </Badge>
                      ))}
                    </div>
                    {contact.position && (
                      <p className="text-sm text-gray-500 truncate">{contact.position}</p>
                    )}
                    <div className="flex items-center gap-4 mt-1">
                      {contact.email_main && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Mail className="h-3 w-3" />
                          {contact.email_main}
                        </span>
                      )}
                      {contact.phone_main && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Phone className="h-3 w-3" />
                          {contact.phone_main}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Aktionen */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                      title="Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/contacts/${contact.id}/edit`)}
                      title="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(contact.id, getDisplayName(contact))}
                      title="Löschen"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}