import { useEffect, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Input, Select } from "@/components/common/Input";
import { getCountries, getStates, getCities } from "@/data/location-data";

interface AddressFieldsProps {
  /** Dot-notation prefix, e.g. "billingAddress" or "shippingAddress" */
  prefix: string;
  /** Optional label prefix shown to the user, e.g. "Billing" or "Shipping" */
  label?: string;
}

/**
 * Cascading Country -> State -> City dropdowns for an address sub-form.
 *
 * Requires the parent form to use `react-hook-form`'s `<FormProvider>` so
 * that `useFormContext()` can access `register`, `setValue`, and `watch`.
 */
export function AddressFields({ prefix, label }: AddressFieldsProps) {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext();

  // Watch the current values for cascading resets
  const country = useWatch({ name: `${prefix}.country` }) as string | undefined;
  const state = useWatch({ name: `${prefix}.state` }) as string | undefined;
  const city = useWatch({ name: `${prefix}.city` }) as string | undefined;

  const countries = useMemo(() => getCountries(), []);
  const states = useMemo(() => (country ? getStates(country) : []), [country]);
  const cities = useMemo(
    () => (country && state ? getCities(country, state) : []),
    [country, state],
  );

  // When country changes, reset state and city if they are no longer valid
  useEffect(() => {
    if (!country) return;
    const validStates = getStates(country);
    if (state && validStates.length > 0 && !validStates.includes(state)) {
      setValue(`${prefix}.state`, "", { shouldValidate: false });
      setValue(`${prefix}.city`, "", { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, prefix, setValue]);

  // When state changes, reset city if it is no longer valid
  useEffect(() => {
    if (!country || !state) return;
    const validCities = getCities(country, state);
    if (city && validCities.length > 0 && !validCities.includes(city)) {
      setValue(`${prefix}.city`, "", { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, prefix, setValue]);

  // Helper to get nested errors
  const getError = (field: string): string | undefined => {
    const parts = `${prefix}.${field}`.split(".");
    let err: Record<string, unknown> | undefined = errors as Record<string, unknown>;
    for (const p of parts) {
      if (!err) return undefined;
      err = err[p] as Record<string, unknown> | undefined;
    }
    return (err as unknown as { message?: string })?.message;
  };

  const labelPrefix = label ? `${label} ` : "";

  return (
    <div className="grid grid-cols-1 gap-4">
      <Input
        label={`${labelPrefix}Address Line 1`}
        placeholder="123 Main Street"
        error={getError("line1")}
        {...register(`${prefix}.line1`)}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label={`${labelPrefix}Country`}
          error={getError("country")}
          {...register(`${prefix}.country`)}
        >
          <option value="">Select country</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        {states.length > 0 ? (
          <Select
            label={`${labelPrefix}State`}
            error={getError("state")}
            {...register(`${prefix}.state`)}
          >
            <option value="">Select state</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            label={`${labelPrefix}State`}
            placeholder="State / Province"
            error={getError("state")}
            {...register(`${prefix}.state`)}
          />
        )}

        {cities.length > 0 ? (
          <Select
            label={`${labelPrefix}City`}
            error={getError("city")}
            {...register(`${prefix}.city`)}
          >
            <option value="">Select city</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            label={`${labelPrefix}City`}
            placeholder="City"
            error={getError("city")}
            {...register(`${prefix}.city`)}
          />
        )}

        <Input
          label={`${labelPrefix}Postal Code`}
          placeholder="400001"
          error={getError("postalCode")}
          {...register(`${prefix}.postalCode`)}
        />
      </div>
    </div>
  );
}
