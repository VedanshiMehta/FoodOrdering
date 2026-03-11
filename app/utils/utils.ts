import { Alert } from "react-native";
class Utils {
  showAlert(message: string, title?: string) {
    Alert.alert(title ?? "", message);
  }
}

export default new Utils();
