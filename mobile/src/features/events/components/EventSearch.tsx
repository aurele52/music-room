import { Action, Field } from '../../../ui/Controls'

interface Props {
  query: string
  setQuery: (value: string) => void
  setActiveQuery: (value: string) => void
}

export default function EventSearch({
  query,
  setQuery,
  setActiveQuery
}: Props) {
  return (
    <>
      <Field
        label="Rechercher une soirée"
        placeholder="Nom de l'événement"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        onSubmitEditing={() => setActiveQuery(query.trim())}
      />
      <Action
        label="Rechercher"
        onPress={() => setActiveQuery(query.trim())}
      />

    </>
  )
}
