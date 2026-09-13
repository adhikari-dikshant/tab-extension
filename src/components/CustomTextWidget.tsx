import { DEFAULT_SETTINGS } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'

export default function CustomTextWidget() {
    const [settings] = useStorageValue('settings', DEFAULT_SETTINGS)
    if (!settings.customText.trim()) return null

    return <p className="welcome-subtitle" title={settings.customText}>{settings.customText}</p>
}
