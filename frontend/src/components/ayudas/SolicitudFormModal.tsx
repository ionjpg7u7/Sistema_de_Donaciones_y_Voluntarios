import { useEffect, useState, type FormEvent } from 'react';
import ModalBase from '../donaciones/ModalBase';
import FieldError from '../ui/FieldError';
import { useToast } from '../../context/ToastContext';
import ayudaApi, { leerErrorAyuda } from '../../api/ayuda.api';
import { ETIQUETA_PRIORIDAD, ETIQUETA_TIPO_AYUDA, nombreCompleto } from '../../utils/ayudaFormat';
import { PRIORIDADES_AYUDA, TIPOS_AYUDA } from '../../types/ayuda.types';
import type { BeneficiarioAyuda, PrioridadAyuda, TipoAyuda } from '../../types/ayuda.types';
import {
  btnPrimario,
  btnSecundario,
  claseEtiqueta,
  claseInput,
  claseInputError,
} from './estilos';

interface Props {
  isOpen: boolean;
  esAdmin: boolean;
  beneficiarios: BeneficiarioAyuda[];
  onClose: () => void;
  onCreada: () => void;
}

const SolicitudFormModal = ({ isOpen, esAdmin, beneficiarios, onClose, onCreada }: Props) => {
  const { exito, error: toastError } = useToast();
  const [beneficiario, setBeneficiario] = useState('');
  const [tipo, setTipo] = useState<TipoAyuda>('GENERAL');
  const [prioridad, setPrioridad] = useState<PrioridadAyuda>('MEDIA');
  const [necesidad, setNecesidad] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setBeneficiario('');
    setTipo('GENERAL');
    setPrioridad('MEDIA');
    setNecesidad('');
    setCantidad('');
    setDescripcion('');
    setIntento(false);
    setErrorServidor('');
  }, [isOpen]);

  const n = Number(cantidad.replace(',', '.'));
  const errores: { beneficiario?: string; necesidad?: string; cantidad?: string; descripcion?: string } = {};
  if (esAdmin && !beneficiario) errores.beneficiario = 'Selecciona un beneficiario verificado.';
  if (necesidad.trim().length < 3) errores.necesidad = 'Describe la necesidad en al menos 3 caracteres.';
  if (necesidad.trim().length > 150) errores.necesidad = 'Máximo 150 caracteres.';
  if (descripcion.trim().length > 1000) errores.descripcion = 'Máximo 1000 caracteres.';
  if (cantidad.trim() !== '') {
    if (!Number.isFinite(n) || n <= 0) errores.cantidad = 'Debe ser un número mayor a cero.';
    else if (Math.abs(Math.round(n * 100) - n * 100) > 1e-6) errores.cantidad = 'Máximo 2 decimales.';
  }

  const enviar = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIntento(true);
    setErrorServidor('');
    if (Object.keys(errores).length > 0) return;

    setGuardando(true);
    try {
      await ayudaApi.crearSolicitud({
        beneficiario_usuario_id: esAdmin ? Number(beneficiario) : undefined,
        tipo_ayuda: tipo,
        necesidad: necesidad.trim(),
        descripcion: descripcion.trim() || undefined,
        cantidad_solicitada: cantidad.trim() === '' ? null : n,
        prioridad,
      });
      exito('La solicitud quedó pendiente de evaluación.', 'Solicitud registrada');
      onCreada();
      onClose();
    } catch (error) {
      const info = leerErrorAyuda(error);
      setErrorServidor(info.errores.length ? info.errores.join(' ') : info.mensaje);
      toastError(info.mensaje, 'No se pudo registrar');
    } finally {
      setGuardando(false);
    }
  };

  const sinBeneficiarios = esAdmin && beneficiarios.length === 0;

  return (
    <ModalBase
      isOpen={isOpen}
      titulo="Nueva solicitud de ayuda"
      subtitulo={esAdmin ? 'Registra una solicitud para un beneficiario verificado.' : 'Cuéntanos qué apoyo necesitas.'}
      ancho="lg"
      bloqueado={guardando}
      onClose={onClose}
      pie={
        <>
          <button type="button" className={btnSecundario} onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-solicitud-ayuda"
            className={btnPrimario}
            disabled={guardando || sinBeneficiarios}
          >
            {guardando ? 'Guardando…' : 'Registrar solicitud'}
          </button>
        </>
      }
    >
      <form id="form-solicitud-ayuda" onSubmit={(event) => void enviar(event)} noValidate className="space-y-4">
        {errorServidor && (
          <div role="alert" className="rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm font-medium text-error">
            {errorServidor}
          </div>
        )}

        {esAdmin && (
          <div>
            <label htmlFor="ay-beneficiario" className={claseEtiqueta}>
              Beneficiario verificado *
            </label>
            <select
              id="ay-beneficiario"
              value={beneficiario}
              onChange={(event) => setBeneficiario(event.target.value)}
              className={intento && errores.beneficiario ? claseInputError : claseInput}
            >
              <option value="">Selecciona…</option>
              {beneficiarios.map((b) => (
                <option key={b.id_usuario} value={b.id_usuario}>
                  {nombreCompleto(b.nombre, b.apellido)} · {b.tipo_beneficiario} · {b.necesidad}
                </option>
              ))}
            </select>
            <FieldError error={errores.beneficiario} touched={intento} />
            {sinBeneficiarios && (
              <p className="mt-1 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-text-muted">
                No hay beneficiarios verificados y activos. Verifica una cuenta desde Usuarios antes de crear la solicitud.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ay-tipo" className={claseEtiqueta}>
              Tipo de ayuda *
            </label>
            <select id="ay-tipo" value={tipo} onChange={(event) => setTipo(event.target.value as TipoAyuda)} className={claseInput}>
              {TIPOS_AYUDA.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETA_TIPO_AYUDA[valor]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ay-prioridad" className={claseEtiqueta}>
              Prioridad *
            </label>
            <select
              id="ay-prioridad"
              value={prioridad}
              onChange={(event) => setPrioridad(event.target.value as PrioridadAyuda)}
              className={claseInput}
            >
              {PRIORIDADES_AYUDA.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETA_PRIORIDAD[valor]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="ay-necesidad" className={claseEtiqueta}>
            Necesidad principal *
          </label>
          <input
            id="ay-necesidad"
            type="text"
            maxLength={150}
            value={necesidad}
            onChange={(event) => setNecesidad(event.target.value)}
            placeholder="Ej. Canasta familiar, medicamentos, ropa de abrigo"
            className={intento && errores.necesidad ? claseInputError : claseInput}
          />
          <FieldError error={errores.necesidad} touched={intento} />
        </div>

        <div>
          <label htmlFor="ay-cantidad" className={claseEtiqueta}>
            Cantidad solicitada (opcional)
          </label>
          <input
            id="ay-cantidad"
            type="number"
            min={0.01}
            step={0.01}
            inputMode="decimal"
            value={cantidad}
            onChange={(event) => setCantidad(event.target.value)}
            placeholder="Ej. 25"
            className={intento && errores.cantidad ? claseInputError : claseInput}
          />
          <FieldError error={errores.cantidad} touched={intento} />
        </div>

        <div>
          <label htmlFor="ay-descripcion" className={claseEtiqueta}>
            Detalle de la situación (opcional)
          </label>
          <textarea
            id="ay-descripcion"
            rows={4}
            maxLength={1000}
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            placeholder="Composición familiar, urgencia, dirección de referencia u otra información útil."
            className={intento && errores.descripcion ? claseInputError : claseInput}
          />
          <FieldError error={errores.descripcion} touched={intento} />
        </div>
      </form>
    </ModalBase>
  );
};

export default SolicitudFormModal;
