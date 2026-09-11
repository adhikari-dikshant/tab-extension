import { DEFAULT_SETTINGS } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'

export default function CustomTextWidget() {
    const [settings] = useStorageValue('settings', DEFAULT_SETTINGS)
    if (!settings.customText.trim()) return null

    return <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">{settings.customText}</p>
}
