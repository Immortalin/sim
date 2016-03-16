import java.lang.IllegalArgumentException;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.util.HashMap;

import org.json.simple.parser.JSONParser;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

public class PurpleOptAdapter {
  public static void main(String[] args) {
    if (args.length != 1) {
      throw new IllegalArgumentException("Please give me a file name.");
    }

    String inputFileName = args[0];
    JSONObject parsedJSON = null;
    FileWriter fw = null;
    try {
      parsedJSON = (JSONObject) (new JSONParser().parse(
        new FileReader(
          new File(
            inputFileName))));
      HashMap<String, Object> returnedResult = PurpleOpt.computeSuggestion(parsedJSON);
      fw = new FileWriter("gout.json");
      fw.write(JSONObject.toJSONString(returnedResult));
      fw.close();
    } catch (Exception e) {
      e.printStackTrace();
    }
  }
}