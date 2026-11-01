import { useState, useEffect, type FormEvent } from 'react'
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Phone,
} from 'lucide-react'
import type { Address } from '../types'
import { buyerApi } from '../buyerApi'
import { toast } from '../../../components/ui/toast'

type Props = {
  token: string
}

type AddressFormState = {
  fullName: string
  phone: string
  street: string
  city: string
  state: string
  postalCode: string
  country: string
  isDefault: boolean
}

const emptyForm: AddressFormState = {
  fullName: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  isDefault: false,
}

export function BuyerAddresses({ token }: Props) {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<AddressFormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof AddressFormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    let isMounted = true
    const fetchAddr = async () => {
      try {
        const result = await buyerApi.getAddresses(token)
        if (isMounted) {
          setAddresses(result.addresses || [])
          setError('')
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load addresses.')
          setLoading(false)
        }
      }
    }
    void fetchAddr()
    return () => {
      isMounted = false
    }
  }, [token])

  const loadAddresses = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await buyerApi.getAddresses(token)
      setAddresses(result.addresses || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load addresses.')
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormErrors({})
    setModalOpen(true)
  }

  const openEditModal = (addr: Address) => {
    setEditingId(addr.id)
    setForm({
      fullName: addr.fullName,
      phone: addr.phone || '',
      street: addr.street,
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country || '',
      isDefault: addr.isDefault,
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const validateForm = (): boolean => {
    const errs: Partial<Record<keyof AddressFormState, string>> = {}

    if (!form.fullName.trim()) errs.fullName = 'Recipient name is required.'
    if (!form.street.trim()) errs.street = 'Street address is required.'
    if (!form.city.trim()) errs.city = 'City is required.'
    if (!form.state.trim()) errs.state = 'State is required.'
    if (!form.postalCode.trim()) errs.postalCode = 'Postal / PIN code is required.'
    if (form.phone.trim() && !/^[+0-9\s\-()]{7,30}$/.test(form.phone.trim())) {
      errs.phone = 'Provide a valid contact number.'
    }

    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setSaving(true)
    try {
      if (editingId) {
        await buyerApi.updateAddress(token, editingId, {
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || null,
          street: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim(),
          country: form.country.trim(),
          isDefault: form.isDefault,
        })
        toast.success('Address updated', 'Delivery address has been saved.')
      } else {
        await buyerApi.createAddress(token, {
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || null,
          street: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim(),
          country: form.country.trim(),
          isDefault: form.isDefault,
        })
        toast.success('Address added', 'New delivery address has been saved.')
      }
      setModalOpen(false)
      await loadAddresses()
    } catch (err) {
      toast.error('Failed to save address', err instanceof Error ? err.message : 'Please check your details.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return
    setDeletingId(id)
    try {
      await buyerApi.deleteAddress(token, id)
      toast.success('Address removed', 'Delivery address deleted.')
      await loadAddresses()
    } catch (err) {
      toast.error('Could not delete address', err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section aria-label="Saved Delivery Addresses">
      <div className="buyer-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="buyer-kicker">DELIVERY PREFERENCES</span>
          <h1 className="buyer-title">Saved Addresses</h1>
          <p className="buyer-subtitle">
            Manage your personal shipping destinations for secure fine-art packaging and dispatch.
          </p>
        </div>

        <button type="button" className="buyer-btn-primary" onClick={openAddModal}>
          <Plus size={16} />
          <span>Add New Address</span>
        </button>
      </div>

      {loading ? (
        <div className="buyer-addresses-grid">
          {[1, 2].map((i) => (
            <div key={i} className="buyer-address-card" style={{ height: '180px' }}>
              <div className="buyer-skeleton-pulse buyer-skeleton-line" style={{ width: '50%' }} />
              <div className="buyer-skeleton-pulse buyer-skeleton-line" style={{ width: '80%' }} />
              <div className="buyer-skeleton-pulse buyer-skeleton-line" style={{ width: '60%' }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="buyer-empty-state">
          <div className="buyer-empty-icon" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
            <AlertCircle size={24} />
          </div>
          <h3>Could not load addresses</h3>
          <p>{error}</p>
          <button type="button" className="buyer-btn-primary" onClick={loadAddresses}>
            Retry
          </button>
        </div>
      ) : addresses.length === 0 ? (
        <div className="buyer-empty-state">
          <div className="buyer-empty-icon">
            <MapPin size={24} />
          </div>
          <h3>No saved delivery addresses</h3>
          <p>
            Add your primary residence or gallery delivery address so your next original artwork purchase can be dispatched seamlessly.
          </p>
          <button type="button" className="buyer-btn-primary" onClick={openAddModal}>
            <Plus size={16} />
            <span>Add Your First Address</span>
          </button>
        </div>
      ) : (
        <div className="buyer-addresses-grid">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`buyer-address-card ${addr.isDefault ? 'is-default' : ''}`}
            >
              {addr.isDefault && <span className="buyer-default-tag">Default Address</span>}

              <div>
                <h4 className="buyer-address-name">{addr.fullName}</h4>
                <div className="buyer-address-body">
                  <p style={{ margin: '0 0 2px' }}>{addr.street}</p>
                  <p style={{ margin: '0 0 2px' }}>
                    {addr.city}, {addr.state} - {addr.postalCode}
                  </p>
                  <p style={{ margin: 0 }}>{addr.country}</p>
                </div>
                {addr.phone && (
                  <div className="buyer-address-phone">
                    <Phone size={13} />
                    <span>{addr.phone}</span>
                  </div>
                )}
              </div>

              <div className="buyer-address-actions">
                <button
                  type="button"
                  className="buyer-address-btn"
                  onClick={() => openEditModal(addr)}
                >
                  <Pencil size={13} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="buyer-address-btn is-danger"
                  onClick={() => handleDelete(addr.id)}
                  disabled={deletingId === addr.id}
                >
                  {deletingId === addr.id ? (
                    <Loader2 size={13} className="buyer-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog for Add / Edit Address */}
      {modalOpen && (
        <div className="buyer-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div
            className="buyer-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="address-modal-title"
          >
            <div className="buyer-modal-header">
              <h3 id="address-modal-title">
                {editingId ? 'Edit Delivery Address' : 'Add New Delivery Address'}
              </h3>
              <button
                type="button"
                className="buyer-modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="buyer-form-group">
                  <label className="buyer-form-label" htmlFor="addr-fullName">
                    Recipient Full Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    id="addr-fullName"
                    type="text"
                    className={`buyer-input ${formErrors.fullName ? 'is-invalid' : ''}`}
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="e.g. Eleanor Vance"
                    required
                  />
                  {formErrors.fullName && <span className="buyer-field-error">{formErrors.fullName}</span>}
                </div>

                <div className="buyer-form-group">
                  <label className="buyer-form-label" htmlFor="addr-phone">
                    Contact Phone Number
                  </label>
                  <input
                    id="addr-phone"
                    type="tel"
                    className={`buyer-input ${formErrors.phone ? 'is-invalid' : ''}`}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                  />
                  {formErrors.phone && <span className="buyer-field-error">{formErrors.phone}</span>}
                </div>

                <div className="buyer-form-group">
                  <label className="buyer-form-label" htmlFor="addr-street">
                    Street Address & Apartment <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    id="addr-street"
                    type="text"
                    className={`buyer-input ${formErrors.street ? 'is-invalid' : ''}`}
                    value={form.street}
                    onChange={(e) => setForm({ ...form, street: e.target.value })}
                    placeholder="e.g. 42 Colaba Causeway, Apt 3B"
                    required
                  />
                  {formErrors.street && <span className="buyer-field-error">{formErrors.street}</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="buyer-form-group">
                    <label className="buyer-form-label" htmlFor="addr-city">
                      City <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      id="addr-city"
                      type="text"
                      className={`buyer-input ${formErrors.city ? 'is-invalid' : ''}`}
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Mumbai"
                      required
                    />
                    {formErrors.city && <span className="buyer-field-error">{formErrors.city}</span>}
                  </div>

                  <div className="buyer-form-group">
                    <label className="buyer-form-label" htmlFor="addr-state">
                      State <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      id="addr-state"
                      type="text"
                      className={`buyer-input ${formErrors.state ? 'is-invalid' : ''}`}
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      placeholder="Maharashtra"
                      required
                    />
                    {formErrors.state && <span className="buyer-field-error">{formErrors.state}</span>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="buyer-form-group">
                    <label className="buyer-form-label" htmlFor="addr-postalCode">
                      PIN / Postal Code <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      id="addr-postalCode"
                      type="text"
                      className={`buyer-input ${formErrors.postalCode ? 'is-invalid' : ''}`}
                      value={form.postalCode}
                      onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                      placeholder="400001"
                      required
                    />
                    {formErrors.postalCode && <span className="buyer-field-error">{formErrors.postalCode}</span>}
                  </div>

                  <div className="buyer-form-group">
                    <label className="buyer-form-label" htmlFor="addr-country">
                      Country
                    </label>
                    <input
                      id="addr-country"
                      type="text"
                      className="buyer-input"
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      placeholder="India"
                    />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--buyer-charcoal)' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--buyer-charcoal)' }}>
                    Set as my default delivery address
                  </span>
                </label>
              </div>

              <div className="buyer-form-actions">
                <button
                  type="button"
                  className="buyer-btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="buyer-btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="buyer-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Address</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
